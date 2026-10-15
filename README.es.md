<div align="center">

# 🧩 WaDesktop-Tweaks

**Ajustes de privacidad y comodidad no oficiales para WhatsApp Desktop en Windows.**
Recuperar mensajes eliminados · historial de ediciones · proveedor de GIFs · desenfoque y PIN · perfiles · 13 idiomas

[![Licencia: Unlicense](https://img.shields.io/badge/licencia-Unlicense-blue.svg)](LICENSE)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%2010%2F11-0078D6)
![Estado](https://img.shields.io/badge/estado-experimental-orange)
![Generado con IA](https://img.shields.io/badge/c%C3%B3digo-generado%20con%20IA-8A2BE2)

[🇬🇧 English](README.md) · 🇪🇸 Español

</div>

---

> [!WARNING]
> **Lee esto primero.**
> - Es un proyecto **no oficial, comunitario y escrito con ayuda de una IA (Claude)**. **No está afiliado, respaldado ni soportado por WhatsApp ni Meta.**
> - Cambia el comportamiento de WhatsApp Desktop. Los términos de WhatsApp no permiten clientes modificados, y algunas opciones cambian lo que se envía a sus servidores o automatizan envíos. **Tu cuenta podría ser restringida o bloqueada. Lo usas bajo tu propio riesgo.**
> - Las opciones con ⚠️ en los ajustes tienen ese riesgo; las marcadas con ⛔ son automatización y son las que más probablemente se detecten.
> - El código es pequeño y legible. **Léelo antes de ejecutarlo**: le das control sobre tu ventana de WhatsApp.

## ✨ Qué hace

| | Función | Notas |
|---|---|---|
| 🔒 | **Lectura diferida** | Sin ticks azules hasta que respondas o pulses ✓✓ ⚠️ |
| 🙈 | **Ocultar «escribiendo…», «grabando…», «en línea»** | Los demás no ven tu actividad ⚠️ |
| 🎧 | **No marcar notas de voz como reproducidas** | Sin micrófono azul ⚠️ |
| 👀 | **Ver estados sin avisar** | El autor no se entera ⚠️ |
| 🗑️ | **Recuperar mensajes eliminados** | Copia local del texto recibido; se muestra en el propio chat ⚠️ |
| ✏️ | **Historial de ediciones** | Haz clic en el ✏️ junto a un mensaje editado para leer sus versiones anteriores (tuyos y de otros) |
| 📦 | **Archivo de estados** | Opcional, por contacto y con límite de tamaño ⚠️ |
| 🎞️ | **Búsqueda de GIFs en KLIPY** | Se envían como GIFs *reales* con el flujo de WhatsApp |
| ⏰ | **Mensajes programados** | Se envían mientras WhatsApp está abierto ⛔ |
| 😀 | **Comodidad** | Doble clic para reaccionar, confirmar stickers, segundos en la hora, respuestas rápidas, resaltar palabras, exportar chat a .txt/.json, botón de guardar medios |
| 🎨 | **Apariencia** | Colores de burbujas, modo compacto, desplazamiento suave con la rueda, ocultar Canales/Comunidades/Meta AI/Estados, CSS propio |
| 🛡️ | **Privacidad en pantalla** | Desenfoque de lista / mensajes / al perder el foco, **bloqueo con PIN**, **botón de pánico** |
| 👤 | **Perfiles y copia de seguridad** | Cambia entre conjuntos de opciones, exporta/importa ajustes |
| 🩺 | **Autodiagnóstico** | Te dice qué función se rompió tras una actualización de WhatsApp; copia un informe de diseño sin datos personales para errores de alineación |
| 🔎 | **Búsqueda** | Un buscador en el panel de ajustes encuentra cualquier opción en todas las secciones |
| 🌍 | **13 idiomas** | English, Español, Português, Français, Deutsch, Italiano, Русский, Türkçe, 日本語, 한국어, 简体中文, Bahasa Indonesia, Polski |

Cada opción tiene un nombre claro, una descripción corta y un tooltip detallado. Abre el botón **⚙** junto al menú de la lista de chats.

## 📋 Requisitos

- **Windows 10 / 11**
- **WhatsApp Desktop de la Microsoft Store** (la app moderna, paquete `5319275A.WhatsAppDesktop`)
- El **WebView2 Runtime** de Microsoft Edge (ya viene con Windows actualizado)
- **Permiso de administrador una vez**, para instalar (ver [por qué](#-por-qué-el-instalador-pide-administrador))

## 🚀 Instalación

1. Descarga el último **`WaDesktop-Tweaks-vX.Y.Z.zip`** desde [Releases](../../releases) y extráelo donde quieras.
2. Haz doble clic en **`Install.cmd`** y acepta el aviso de permisos de Windows.
3. Abre WhatsApp Desktop. Verás un botón **⚙** junto al menú de la lista de chats.

Eso es todo: sin programa en segundo plano, sin puertos abiertos, nada que iniciar.

### Qué hace el instalador

1. Copia la carpeta `extension/` a `%USERPROFILE%\WaDesktop-Tweaks\`.
2. Añade dos argumentos de inicio para el navegador embebido de WhatsApp (WebView2) en la clave de políticas de Windows
   `HKCU\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments` →  
   `--disable-features=DisableLoadExtensionCommandLineSwitch --load-extension="…\WaDesktop-Tweaks\extension"`.
   Los argumentos que ya tuvieras se conservan.
3. Crea dos accesos en el menú Inicio: **WaDesktop-Tweaks Update** y **WaDesktop-Tweaks Uninstall**.

**No** modifica archivos de WhatsApp y **no** necesita Node.js, Python ni ningún otro entorno.

### ❓ Por qué el instalador pide administrador

Windows protege la rama `Policies` del registro, por lo que escribir ahí exige permisos de administrador: es una regla de Windows, no una decisión de este proyecto. Solo hace falta **para instalar y desinstalar**. Actualizar y el uso diario nunca lo piden.

## 🔄 Actualizar

Las mejoras consultan GitHub una vez al día (puedes desactivarlo) y te avisan cuando hay una versión nueva. Para actualizar, ejecuta **WaDesktop-Tweaks Update** desde el menú Inicio (o el comando que muestra el aviso). Descarga la versión, **verifica su suma SHA-256** y reemplaza los archivos; luego reinicia WhatsApp.

## 🧹 Desinstalar

Panel de ajustes → **Ajustes y actualizaciones → Desinstalar**, o menú Inicio → **WaDesktop-Tweaks Uninstall**, o doble clic en `Uninstall.cmd`. Quita los argumentos que añadió (los tuyos se conservan), los accesos y los archivos instalados. Tus chats y tu cuenta no se tocan. Los ajustes y copias guardadas viven en el perfil del navegador de WhatsApp; bórralos antes desde el panel si quieres eliminarlos.

## 🎞️ GIFs: usar KLIPY (opcional)

WhatsApp mantiene su propio selector de GIFs. Si quieres buscar también en **KLIPY**, necesitas una **clave de API gratuita**: mira **[docs/KEYS.md](docs/KEYS.md)** (unos 2 minutos). Pégala en *Ajustes → GIFs*. Sin clave no cambia nada y sigues con los GIFs de WhatsApp.

## 🔐 Privacidad y seguridad

- **Sin telemetría.** No se recopila ni se envía nada al autor.
- Todo lo que guardan las mejoras (mensajes recuperados, historial de ediciones, estados archivados, mensajes programados, ajustes) queda **en tu PC**, en el perfil del navegador de WhatsApp. Puedes borrarlo desde el panel.
- Las únicas peticiones de red de la extensión son a **`api.klipy.com` / `static*.klipy.com`** (solo si configuras una clave de KLIPY) y **`api.github.com`** (comprobar actualizaciones). Todo lo demás pasa por WhatsApp como siempre.
- El contenido de «ver una vez» **nunca** se guarda, y WhatsApp Desktop no puede abrirlo (la clave del archivo no se envía a dispositivos vinculados).
- El **bloqueo con PIN es una cubierta de pantalla**, no cifrado. Frena miradas ocasionales, no a alguien con acceso técnico a tu PC.
- Para reportar una vulnerabilidad, mira [SECURITY.md](SECURITY.md).

## 🧠 Cómo funciona

WhatsApp Desktop es una envoltura fina de WhatsApp Web (WebView2). Chromium permite cargar una extensión desde disco con un argumento de inicio, y el anfitrión de WhatsApp deja las extensiones habilitadas. La extensión inyecta scripts en la página *antes* que los de WhatsApp, que luego parchean unas pocas funciones internas (confirmaciones de lectura, estado de escritura…) y leen la colección local de mensajes. Detalles y razones de cada decisión: **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## 🩺 Solución de problemas

- **Una función dejó de funcionar tras actualizar WhatsApp** → *Ajustes y actualizaciones → Autodiagnóstico*. Un ✖ indica qué cambió; abre una incidencia con el informe copiado. Si algo se ve desalineado, pulsa **Ctrl+Alt+Shift+L** (o *Copiar informe de diseño* en el mismo diálogo) y adjunta el resultado: solo contiene la estructura de la página, sin texto de mensajes.
- **No aparece el botón ⚙** → reinicia WhatsApp por completo (también desde la bandeja). Comprueba la instalación con `reg query HKCU\Software\Policies\Microsoft\Edge\WebView2\AdditionalBrowserArguments`: debe mostrar `--load-extension="…\WaDesktop-Tweaks\extension"` apuntando a una carpeta que exista. La extensión vive en tu carpeta de usuario (no en `%LOCALAPPDATA%`, que el paquete MSIX de WhatsApp no puede ver).
- **Aviso del antivirus** → el instalador es un script de PowerShell que escribe un valor del registro; léelo en `installer/`.

## 🤝 Contribuir

Traducciones, reportes de errores y arreglos son bienvenidos: mira [CONTRIBUTING.md](CONTRIBUTING.md). Los archivos de traducción son objetos JS simples en `extension/locales/`; las traducciones fueron generadas automáticamente y **se agradecen correcciones de la comunidad**.

## 🙏 Créditos

Inspirado en [WaEnhancer](https://github.com/Dev4Mod/waenhancer) (módulo Xposed para Android). Este proyecto es independiente y no comparte código con él.

## 📄 Licencia

[The Unlicense](LICENSE): dominio público. Haz lo que quieras, sin garantía.
