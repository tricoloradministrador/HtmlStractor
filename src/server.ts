import express from 'express';
import cors from 'cors';
import * as path from 'path';
import * as fs from 'fs-extra';
import archiver from 'archiver';
import { scrape } from './scraper';
import { generateReactComponent } from './converter';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const OUTPUT_DIR = path.join(__dirname, '../output');

app.post('/api/scrape', async (req, res) => {
    const { url, convertToReact } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'URL requerida' });
    }

    try {
        console.log(`Solicitud de scraping para: ${url} (React: ${convertToReact})`);

        // Ejecutar scraper
        await scrape(url, OUTPUT_DIR, (msg) => {
            console.log(`[Scraper] ${msg}`);
        });

        // Conversion a React si se solicita
        if (convertToReact) {
            const htmlPath = path.join(OUTPUT_DIR, 'index.html');
            if (await fs.pathExists(htmlPath)) {
                console.log('⚛️  Convirtiendo a React Component...');
                const htmlContent = await fs.readFile(htmlPath, 'utf-8');
                const jsxContent = generateReactComponent(htmlContent);
                await fs.outputFile(path.join(OUTPUT_DIR, 'TricolorComponent.jsx'), jsxContent);
                console.log('✅ Componente React generado.');
            }
        }

        // Crear ZIP
        const zipPath = path.join(__dirname, '../site_download.zip');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => {
            console.log('ZIP creado exitosamente');
            res.json({ success: true, downloadUrl: '/download/site_download.zip' });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(OUTPUT_DIR, false);
        await archive.finalize();

    } catch (error: any) {
        console.error('Error en el proceso:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, `../${req.params.filename}`);
    res.download(filePath);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor de Scraping Premium corriendo en http://localhost:${PORT}`);
});
