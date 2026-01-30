"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const puppeteer_1 = __importDefault(require("puppeteer"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs-extra"));
const path = __importStar(require("path"));
const TARGET_URL = process.argv[2];
if (!TARGET_URL) {
    console.error('❌ Por favor proporciona una URL como argumento.');
    console.error('Ejemplo: npx ts-node src/scraper.ts https://ejemplo.com');
    process.exit(1);
}
const OUTPUT_DIR = path.join(__dirname, '../output');
const CSS_DIR = path.join(OUTPUT_DIR, 'css');
async function downloadFile(url, dest) {
    try {
        const response = await (0, axios_1.default)({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        await fs.outputFile(dest, response.data);
        console.log(`✅ Descargado: ${path.basename(dest)}`);
    }
    catch (error) {
        console.error(`❌ Error descargando ${url}: ${error.message}`);
    }
}
async function scrape() {
    console.log(`🔍 Iniciando scraping de: ${TARGET_URL}`);
    // Limpiar directorio de salida
    await fs.emptyDir(OUTPUT_DIR);
    await fs.ensureDir(CSS_DIR);
    const browser = await puppeteer_1.default.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle0' });
        // Obtener HTML completo
        let html = await page.content();
        // Extraer enlaces CSS
        const cssLinks = await page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
            return links.map(link => link.href).filter(href => href);
        });
        console.log(`📦 Encontrados ${cssLinks.length} archivos CSS.`);
        // Descargar CSS y reemplazar links en HTML
        for (let i = 0; i < cssLinks.length; i++) {
            const cssUrl = cssLinks[i];
            const cssFileName = `style_${i}.css`;
            const cssPath = path.join(CSS_DIR, cssFileName);
            await downloadFile(cssUrl, cssPath);
            // Reemplazar la URL absoluta en el HTML con la ruta local relativa
            // Nota: Esto es un reemplazo simple, puede necesitar ser más robusto para casos complejos
            html = html.replace(cssUrl, `./css/${cssFileName}`);
        }
        // Guardar HTML modificado
        const htmlPath = path.join(OUTPUT_DIR, 'index.html');
        await fs.outputFile(htmlPath, html);
        console.log(`🎉 HTML guardado en: ${htmlPath}`);
    }
    catch (error) {
        console.error('❌ Error durante el scraping:', error);
    }
    finally {
        await browser.close();
    }
}
scrape();
