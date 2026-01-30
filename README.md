# Web Scraper Pro 🚀

Herramienta profesional para clonar sitios web completas, extrayendo y organizando todos sus recursos.

## 🌟 Características
- **Extracción Completa**: Descarga HTML, CSS, Javascript, Fuentes, Imágenes y Logos.
- **Modo React**: Convierte automáticamente el HTML a un componente **JSX** listo para usar.
- **Bundling Inteligente**: 
  - Une todos los estilos en un solo archivo `css/bundle.css`.
  - Une todos los scripts en un solo archivo `js/bundle.js`.
- **Cazador de Logos**: Detecta Favicons y metadatos de imágenes (Open Graph) para no perder la identidad de la marca.
- **UI Premium**: Interfaz web moderna con modo oscuro y descarga en ZIP.

## 🛠️ Requisitos Previos
- Tener instalado **Node.js** en tu computadora.

## 📥 Instalación

1. Abre una terminal en la carpeta del proyecto (`htmlScraping`).
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```

## 🚀 Cómo Ejecutar

1. Inicia el servidor de desarrollo:
   ```bash
   npx ts-node src/server.ts
   ```
   *(Verás un mensaje diciendo que el servidor corre en el puerto 3000)*

2. Abre tu navegador web e ingresa a:
   👉 **http://localhost:3000**

3. **Uso**:
   - Pega la URL del sitio que quieres clonar.
   - Marca la casilla **"Convertir a React"** si deseas el archivo `.jsx`.
   - Presiona **"Iniciar Extracción"**.
   - Espera a que termine y descarga el archivo **ZIP**.

## 📂 Estructura del Output (ZIP)
- `index.html`: Tu página clonada y limpia.
- `TricolorComponent.jsx`: (Opcional) Versión React.
- `css/bundle.css`: Todos los estilos unidos.
- `js/bundle.js`: Todos los scripts unidos.
- `images/`: Carpeta con todas las imágenes, logos y favicons descargados.
- `css/fonts/`: Fuentes web extraídas.

---
*Desarrollado para Proyecto Tricolor*
