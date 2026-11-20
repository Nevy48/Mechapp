/*
 * Sistema de Medición de Nivel de Agua + Control de Llenado
 * ----------------------------------------------------------
 * El Arduino da la orden de llenado cerrando un relé que ocupa el lugar
 * del automático del tanque en el circuito existente de la bomba.
 * Solo da la orden si el automático de la cisterna confirma que hay agua.
 * Además verifica que el nivel del tanque realmente suba.
 *
 * Circuito real (220 V):
 *   Fase -> [Automático cisterna] -> (X) -> [Relé NA] -> Bomba -> Neutro
 *                                     |
 *                          [Detector 220V optoacoplado] -> PIN_CISTERNA
 *
 * En TinkerCAD: 220 V = batería 9 V, automático cisterna = interruptor
 * deslizante, bomba = motor DC, detector = optoacoplador 4N35.
 *
 * Para integrarlo al proyecto existente: copiar las secciones marcadas
 * [CONTROL] y llamar a leerCisterna() y controlLlenado() en loop().
 * Los parámetros del tanque salen de la EEPROM (configuración por teclado).
 */

#define SIMULACION 1   // 1 = tiempos cortos para TinkerCAD, 0 = tiempos reales

// ---------- Pines (ajustar a los que queden libres en su circuito) ----------
const uint8_t PIN_TRIG     = 7;
const uint8_t PIN_ECHO     = 6;
const uint8_t PIN_CISTERNA = A3;  // colector del optoacoplador (LOW = cisterna con agua)
const uint8_t PIN_RELE     = A2;  // base del transistor que maneja la bobina del relé

// ---------- Parámetros del tanque (en el proyecto: leídos de EEPROM) ----------
float dMax      = 110.0;  // cm, sensor -> fondo (tanque vacío)
float dMin      = 10.0;   // cm, sensor -> agua con tanque lleno
float capacidad = 500.0;  // litros

uint8_t umbralCritico   = 10;  // %
uint8_t umbralBajo      = 20;  // %  -> también es el nivel de ENCENDIDO del llenado
uint8_t umbralLleno     = 90;  // %  -> nivel de APAGADO del llenado
const uint8_t HISTERESIS = 2;  // puntos % para las alertas

// ---------- [CONTROL] Tiempos del control de llenado ----------
#if SIMULACION
const unsigned long T_ANTIRREBOTE  = 2000UL;    // cisterna estable antes de aceptar el cambio
const unsigned long T_MIN_APAGADO  = 5000UL;    // anti-ciclado de la bomba
const unsigned long T_VERIFICACION = 20000UL;   // cada cuánto se exige que el nivel suba
const unsigned long T_MAX_LLENADO  = 180000UL;  // corte de seguridad por tiempo
const unsigned long T_REINTENTO    = 30000UL;   // espera tras una falla
#else
const unsigned long T_ANTIRREBOTE  = 3000UL;
const unsigned long T_MIN_APAGADO  = 60000UL;   // 1 min
const unsigned long T_VERIFICACION = 180000UL;  // 3 min
const unsigned long T_MAX_LLENADO  = 2400000UL; // 40 min
const unsigned long T_REINTENTO    = 600000UL;  // 10 min
#endif
const float   SUBIDA_MINIMA  = 2.0;  // puntos % que debe subir en cada T_VERIFICACION
const uint8_t MAX_REINTENTOS = 3;    // fallas seguidas antes de bloquear

const unsigned long T_MUESTRA = 200UL;   // 5 muestras -> 1 medición por segundo
const unsigned long T_ENVIO   = 5000UL;

// ---------- Estado de la medición ----------
float muestras[5];
uint8_t nMuestra = 0;
float distancia = 0, nivel = 0, litros = 0;
bool sensorOk = false;
bool medicionNueva = false;

// ---------- [CONTROL] Estado de la cisterna ----------
bool cisternaConAgua = false;
bool lecturaCisAnterior = false;
unsigned long tCambioCis = 0;

// ---------- [CONTROL] Máquina de estados del llenado ----------
enum EstadoLlenado { REPOSO, ESPERA_CISTERNA, LLENANDO, FALLA, BLOQUEO };
EstadoLlenado estado = REPOSO;
const char* motivoFalla = "-";
unsigned long tApagado = 0, tInicioLlenado = 0, tUltimaVerif = 0, tFalla = 0;
float nivelUltimaVerif = 0;
uint8_t fallasSeguidas = 0;

// ---------- Alertas y envío ----------
enum Alerta { A_OK, A_BAJO, A_CRITICO, A_LLENO, A_SENSOR };
Alerta alerta = A_OK;
bool enviarYa = false;
unsigned long tUltimaMuestra = 0, tUltimoEnvio = 0;

// Prototipos explícitos (evitan errores del IDE con parámetros de tipo enum)
void tomarMuestra();
void leerCisterna();
void controlLlenado();
void cambiarEstado(EstadoLlenado nuevo);
void arrancarBomba();
void detenerBomba(EstadoLlenado siguiente, const char* motivo);
void evaluarAlerta();
void enviarTrama();

// =============================================================
void setup() {
  Serial.begin(9600);
  pinMode(PIN_TRIG, OUTPUT);
  pinMode(PIN_ECHO, INPUT);
  pinMode(PIN_CISTERNA, INPUT_PULLUP);
  pinMode(PIN_RELE, OUTPUT);
  digitalWrite(PIN_RELE, LOW);            // arranca siempre con la bomba sin orden
  tApagado = millis() - T_MIN_APAGADO;    // permite arrancar sin esperar el anti-ciclado
  lecturaCisAnterior = (digitalRead(PIN_CISTERNA) == LOW);
  tCambioCis = millis();
}

void loop() {
  unsigned long ahora = millis();

  if (ahora - tUltimaMuestra >= T_MUESTRA) {
    tUltimaMuestra = ahora;
    tomarMuestra();
  }

  leerCisterna();

  if (medicionNueva) {
    medicionNueva = false;
    evaluarAlerta();
    controlLlenado();
  }

  if (enviarYa || ahora - tUltimoEnvio >= T_ENVIO) {
    enviarTrama();
    enviarYa = false;
    tUltimoEnvio = ahora;
  }
}

// =============================================================
// Medición: 5 muestras, mediana, conversión a % y litros
// =============================================================
float leerDistanciaCm() {
  digitalWrite(PIN_TRIG, LOW);  delayMicroseconds(2);
  digitalWrite(PIN_TRIG, HIGH); delayMicroseconds(10);
  digitalWrite(PIN_TRIG, LOW);
  unsigned long us = pulseIn(PIN_ECHO, HIGH, 30000UL);
  if (us == 0) return -1;       // sin eco
  return us / 58.0;
}

void tomarMuestra() {
  muestras[nMuestra++] = leerDistanciaCm();
  if (nMuestra < 5) return;
  nMuestra = 0;

  // mediana de 5 (ordenamiento por inserción)
  float m[5];
  for (uint8_t i = 0; i < 5; i++) m[i] = muestras[i];
  for (uint8_t i = 1; i < 5; i++) {
    float k = m[i]; int8_t j = i - 1;
    while (j >= 0 && m[j] > k) { m[j + 1] = m[j]; j--; }
    m[j + 1] = k;
  }
  distancia = m[2];

  // fuera de rango = sensor en falla (nunca se llena con una lectura dudosa)
  sensorOk = (distancia > 0) && (distancia <= dMax + 10);
  if (sensorOk) {
    nivel = (dMax - distancia) / (dMax - dMin) * 100.0;
    nivel = constrain(nivel, 0, 100);
    litros = capacidad * nivel / 100.0;
  }
  medicionNueva = true;
}

// =============================================================
// [CONTROL] Lectura del automático de la cisterna con antirrebote
// =============================================================
void leerCisterna() {
  bool lectura = (digitalRead(PIN_CISTERNA) == LOW);  // optoacoplador conduce = hay tensión
  if (lectura != lecturaCisAnterior) {
    lecturaCisAnterior = lectura;
    tCambioCis = millis();
  }
  if (millis() - tCambioCis >= T_ANTIRREBOTE && cisternaConAgua != lectura) {
    cisternaConAgua = lectura;
    enviarYa = true;               // el cambio de cisterna se informa de inmediato
    controlLlenado();              // y se reevalúa el llenado sin esperar la medición
  }
}

// =============================================================
// [CONTROL] Máquina de estados del llenado
// =============================================================
void cambiarEstado(EstadoLlenado nuevo) {
  if (estado != nuevo) { estado = nuevo; enviarYa = true; }
}

void arrancarBomba() {
  digitalWrite(PIN_RELE, HIGH);
  tInicioLlenado = tUltimaVerif = millis();
  nivelUltimaVerif = nivel;
  motivoFalla = "-";
  cambiarEstado(LLENANDO);
}

void detenerBomba(EstadoLlenado siguiente, const char* motivo) {
  digitalWrite(PIN_RELE, LOW);
  tApagado = millis();
  if (siguiente == FALLA) {
    motivoFalla = motivo;
    tFalla = millis();
    fallasSeguidas++;
    if (fallasSeguidas >= MAX_REINTENTOS) siguiente = BLOQUEO;  // requiere reset manual
  }
  cambiarEstado(siguiente);
}

void controlLlenado() {
  unsigned long ahora = millis();
  bool antiCicladoOk = (ahora - tApagado >= T_MIN_APAGADO);

  switch (estado) {
    case REPOSO:
      if (sensorOk && nivel <= umbralBajo && antiCicladoOk) {
        if (cisternaConAgua) arrancarBomba();
        else                 cambiarEstado(ESPERA_CISTERNA);
      }
      break;

    case ESPERA_CISTERNA:
      if (sensorOk && nivel > umbralBajo + HISTERESIS) { cambiarEstado(REPOSO); break; }
      if (sensorOk && cisternaConAgua && antiCicladoOk) arrancarBomba();
      break;

    case LLENANDO:
      if (!sensorOk)            { detenerBomba(FALLA, "SENSOR");     break; }
      if (!cisternaConAgua)     { detenerBomba(ESPERA_CISTERNA, "-"); break; }
      if (nivel >= umbralLleno) { fallasSeguidas = 0; detenerBomba(REPOSO, "-"); break; }
      if (ahora - tInicioLlenado >= T_MAX_LLENADO) { detenerBomba(FALLA, "TIEMPO_MAX"); break; }
      if (ahora - tUltimaVerif >= T_VERIFICACION) {
        if (nivel - nivelUltimaVerif < SUBIDA_MINIMA) { detenerBomba(FALLA, "SIN_CAUDAL"); break; }
        nivelUltimaVerif = nivel;
        tUltimaVerif = ahora;
      }
      break;

    case FALLA:
      if (ahora - tFalla >= T_REINTENTO) cambiarEstado(REPOSO);
      break;

    case BLOQUEO:
      // Se sale con el botón de reset del Arduino
      // (en el proyecto completo, con una tecla del teclado matricial).
      break;
  }
}

// =============================================================
// Alertas de nivel (con histéresis) y trama
// =============================================================
void evaluarAlerta() {
  Alerta nueva = alerta;
  if (!sensorOk) nueva = A_SENSOR;
  else if (nivel < umbralCritico) nueva = A_CRITICO;
  else if (nivel < umbralBajo)    nueva = (alerta == A_CRITICO && nivel < umbralCritico + HISTERESIS) ? A_CRITICO : A_BAJO;
  else if (nivel >= umbralLleno)  nueva = A_LLENO;
  else {
    // zona normal: solo se sale de BAJO/LLENO al alejarse HISTERESIS puntos del umbral
    if (alerta == A_BAJO || alerta == A_CRITICO) nueva = (nivel >= umbralBajo + HISTERESIS) ? A_OK : A_BAJO;
    else if (alerta == A_LLENO)                  nueva = (nivel < umbralLleno - HISTERESIS) ? A_OK : A_LLENO;
    else                                         nueva = A_OK;
  }
  if (nueva != alerta) { alerta = nueva; enviarYa = true; }
}

const char* txtAlerta() {
  switch (alerta) {
    case A_BAJO: return "BAJO"; case A_CRITICO: return "CRITICO";
    case A_LLENO: return "LLENO"; case A_SENSOR: return "FALLA_SENSOR";
    default: return "OK";
  }
}

const char* txtEstado() {
  switch (estado) {
    case ESPERA_CISTERNA: return "ESPERA_CISTERNA"; case LLENANDO: return "LLENANDO";
    case FALLA: return "FALLA"; case BLOQUEO: return "BLOQUEO";
    default: return "REPOSO";
  }
}

void enviarTrama() {
  Serial.print(F("{\"id\":\"T1\",\"nivel\":"));  Serial.print((int)nivel);
  Serial.print(F(",\"litros\":"));               Serial.print((int)litros);
  Serial.print(F(",\"dist_cm\":"));              Serial.print((int)distancia);
  Serial.print(F(",\"alerta\":\""));             Serial.print(txtAlerta());
  Serial.print(F("\",\"cisterna\":\""));         Serial.print(cisternaConAgua ? "CON_AGUA" : "VACIA");
  Serial.print(F("\",\"bomba\":\""));            Serial.print(digitalRead(PIN_RELE) ? "ON" : "OFF");
  Serial.print(F("\",\"llenado\":\""));          Serial.print(txtEstado());
  Serial.print(F("\",\"falla\":\""));            Serial.print(motivoFalla);
  Serial.println(F("\"}"));
}
