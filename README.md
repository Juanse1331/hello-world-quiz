# Hello World Quiz - ACEIS

Quiz interactivo en tiempo real para la competencia Hello World de ACEIS.
Basado en Vue 3 + Socket.io. Funciona en red local (WiFi del salon).

## Requisitos

- Node.js v18 o superior

## Instalacion

```bash
# Instalar dependencias del servidor
cd server
npm install

# Instalar dependencias del cliente
cd ../client
npm install
```

## Configuracion

Edita `server/.env` para personalizar:

```env
ADMIN_PASSWORD=aceis2024   # Contrasena del panel admin
PORT=3000                  # Puerto del servidor
```

## Uso

### 1. Construir el cliente (una sola vez o cuando hagas cambios)

```bash
cd client
npm run build
```

### 2. Iniciar el servidor

```bash
cd server
node index.js
```

O desde la raiz del proyecto:
```bash
npm start
```

El servidor arranca en `http://localhost:3000`

### 3. Acceso desde otros equipos (red local)

1. Averigua la IP de tu computador:
   - Windows: ejecuta `ipconfig` en la terminal, busca "Direccion IPv4"
   - Ejemplo: `192.168.1.15`
2. Los estudiantes acceden desde su navegador a: `http://192.168.1.15:3000`
3. Tu accedes al panel admin en: `http://192.168.1.15:3000/admin`

## Flujo de uso

1. **Profesor** abre `/admin`, ingresa la contrasena
2. Selecciona las preguntas del banco, activa el temporizador (opcional)
3. Hace clic en "Crear Sala" -> aparece el codigo (ej: `ABCD-1234`)
4. **Estudiantes** abren la URL, ingresan su nombre, codigo de estudiante y el codigo de sala
5. Profesor ve los participantes conectados y hace clic en "Iniciar Quiz"
6. Las preguntas aparecen simultaneamente para todos
7. Profesor controla el avance pregunta a pregunta desde el panel
8. Al terminar, estudiantes ven sus resultados y el profesor puede exportar el CSV

## Banco de preguntas

30 preguntas en `server/data/banco_preguntas.json`:
- 10 Facil (15 pts c/u) - SM, VF, IMP, COMP
- 10 Medio (20 pts c/u) - SM, VF, IMP, ERR, COMP, DF
- 10 Dificil (30 pts c/u) - IMP, ERR, COMP, SM, VF, DF

Tipos: SM (Seleccion Multiple), VF (Verdadero/Falso), IMP (Que imprime?),
ERR (Encontrar error), COMP (Completar pseudocodigo), DF (Diagrama de flujo)