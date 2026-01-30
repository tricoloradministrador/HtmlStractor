import puppeteer from 'puppeteer';
import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import { URL } from 'url';

const TARGET_URL = process.argv[2];

if (!TARGET_URL) {
    console.error('❌ Por favor proporciona una URL como argumento.');
    console.error('https://www.banco.scotiabankcolpatria.com/banca-virtual/login/?_gl=1*ws8ht0*_gcl_au*MTM4NDQzODMxNy4xNzY5NzMxNDE4*_ga*MTE3ODQzMDM5MS4xNzY5NzMxNDE4*_ga_SDTSNW5N1C*czE3Njk3MzE0MTgkbzEkZzEkdDE3Njk3MzE3NDMkajIzJGwwJGgw*_ga_HBL945RPW6*czE3Njk3MzE0MTgkbzEkZzEkdDE3Njk3MzE3NDMkajIzJGwwJGgw');
    process.exit(1);
}

const OUTPUT_DIR = path.join(__dirname, '../output');
const CSS_DIR = path.join(OUTPUT_DIR, 'css');
async function downloadFile(url: string, dest: string) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer'
        });
        await fs.outputFile(dest, response.data);
        console.log(`✅ Descargado: ${path.basename(dest)}`);
    } catch (error: any) {
        console.error(`❌ Error descargando ${url}: ${error.message}`);
    }
}

async function scrape() {
    console.log(`🔍 Iniciando scraping de: ${TARGET_URL}`);

    // Limpiar directorio de salida
    await fs.emptyDir(OUTPUT_DIR);
    await fs.ensureDir(CSS_DIR);

    const browser = await puppeteer.launch({
        headless: true,
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
            return links.map(link => (link as HTMLLinkElement).href).filter(href => href);
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

        // --- Extracción de JS ---
        const JS_DIR = path.join(OUTPUT_DIR, 'js');
        await fs.ensureDir(JS_DIR);

        const jsLinks = await page.evaluate(() => {
            const scripts = Array.from(document.querySelectorAll('script[src]'));
            return scripts.map(script => (script as HTMLScriptElement).src).filter(src => src);
        });

        console.log(`📦 Encontrados ${jsLinks.length} archivos JS.`);

        for (let i = 0; i < jsLinks.length; i++) {
            const jsUrl = jsLinks[i];
            // Intentar obtener nombre de archivo, o usar generico
            const jsFileName = `script_${i}.js`;
            const jsPath = path.join(JS_DIR, jsFileName);

            await downloadFile(jsUrl, jsPath);

            // Reemplazo simple
            html = html.replace(jsUrl, `./js/${jsFileName}`);
        }

        // Guardar HTML modificado
        const htmlPath = path.join(OUTPUT_DIR, 'index.html');
        await fs.outputFile(htmlPath, html);
        console.log(`🎉 HTML guardado en: ${htmlPath}`);

    } catch (error) {
        console.error('❌ Error durante el scraping:', error);
    } finally {
        await browser.close();
    }
}

scrape();
