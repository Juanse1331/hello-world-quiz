# Prueba de Piston (fase 1 del modo reto)

Piston compila y ejecuta el código de los estudiantes (Python y C++) en una caja aislada.
Esta carpeta sirve para comprobar que funciona en el PC del servidor **antes** de programar el modo reto.

## Pasos (PowerShell, dentro de esta carpeta `piston/`)

1. **Docker Desktop abierto** (ícono de la ballena en verde). Verifica la versión de cgroups:
   ```powershell
   docker info | findstr /i cgroup
   ```
   Debe decir `Cgroup Version: 2`.

2. **Levantar Piston:**
   ```powershell
   docker compose up -d
   docker compose logs piston
   ```
   La primera vez descarga la imagen. En los logs debe aparecer que la API escucha en el puerto 2000.

3. **Correr la prueba** (instala Python y C++ la primera vez; puede tardar varios minutos):
   ```powershell
   node prueba-piston.mjs
   ```

4. **Prueba de carga** (simula 40 estudiantes enviando C++ a la vez):
   ```powershell
   node prueba-piston.mjs --carga
   ```

5. **Comprobar que NO está expuesto a la red:** desde OTRO equipo (o un celular en el mismo WiFi) abre
   `http://IP-DEL-SERVIDOR:2000/api/v2/runtimes`. **No debe cargar.** En el propio PC,
   `http://localhost:2000/api/v2/runtimes` sí debe responder.

## Si algo falla

| Síntoma | Qué revisar |
|---|---|
| `No responde` en el paso 1 del script | `docker compose ps` — el contenedor debe estar `running`. Si se reinicia en bucle: `docker compose logs piston` |
| Errores de `cgroup` / `isolate` en los logs | Docker Desktop → Settings → General: "Use the WSL 2 based engine" activado. Actualiza Docker Desktop y WSL (`wsl --update`) |
| Python o C++ no se instalan | Revisa internet. Vuelve a correr `node prueba-piston.mjs` (retoma la instalación) |
| Status `XX` (error interno) al ejecutar | Copia la salida y los logs y revísalos |

Para apagarlo: `docker compose down` (los lenguajes instalados se conservan).
