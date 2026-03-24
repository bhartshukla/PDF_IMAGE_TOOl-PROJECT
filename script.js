
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
    
    // Global state
    const state = {
        imageFiles: [],
        pdfToImageFile: null,
        imagesToPdfFiles: [],
        convertedImages: [],
        extractedImages: [],
        currentImageFormat: 'png',
        currentPdfImageFormat: 'png',
        pdfPageSize: 'a4'
    };

    // Helper functions
    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icon = type === 'success' ? 'ri-checkbox-circle-line' : type === 'error' ? 'ri-error-warning-line' : 'ri-information-line';
        toast.innerHTML = `<i class="ri ${icon}"></i><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(100%)'; setTimeout(() => toast.remove(), 300); }, 2800);
    }

    function formatFileSize(bytes) {
        if (!bytes) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function revokeObjectURLs(urls) {
        urls.forEach(url => { if (url) URL.revokeObjectURL(url); });
    }

    function setButtonLoading(btn, loading, originalText = null) {
        if (loading) {
            btn.disabled = true;
            btn.dataset.originalText = btn.innerHTML;
            btn.innerHTML = '<div class="spinner"></div> Processing...';
        } else {
            btn.disabled = false;
            btn.innerHTML = btn.dataset.originalText || (originalText || btn.innerHTML);
        }
    }

    document.getElementById('imageUploadZone').addEventListener('click', () => {
    document.getElementById('imageInput').click();
});

document.getElementById('pdfToImageZone').addEventListener('click', () => {
    document.getElementById('pdfToImageInput').click();
});

document.getElementById('imagesToPdfZone').addEventListener('click', () => {
    document.getElementById('imagesToPdfInput').click();
});

    // ==================== IMAGE CONVERTER ====================
    const imageZone = document.getElementById('imageUploadZone');
    const imageInput = document.getElementById('imageInput');
    const imagePreviewList = document.getElementById('imagePreviewList');
    const imageControls = document.getElementById('imageControls');
    const convertImagesBtn = document.getElementById('convertImagesBtn');
    const qualitySlider = document.getElementById('qualitySlider');
    const qualityValue = document.getElementById('qualityValue');

    function updateImagePreview() {
        const oldImages = document.querySelectorAll('#imagePreviewList .preview-thumb');
        oldImages.forEach(img => { if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
        
        imagePreviewList.innerHTML = state.imageFiles.map((f, i) => {
            const previewUrl = URL.createObjectURL(f);
            return `<div class="preview-item" data-idx="${i}"><img src="${previewUrl}" class="preview-thumb"><div class="preview-info"><div class="preview-name">${escapeHtml(f.name)}</div><div class="preview-size">${formatFileSize(f.size)}</div></div><button class="preview-remove" onclick="window.removeImage(${i})"><i class="ri-close-line"></i></button></div>`;
        }).join('');
    }

    window.removeImage = (idx) => {
        if (state.imageFiles[idx]) {
            state.imageFiles.splice(idx, 1);
            updateImagePreview();
            if (!state.imageFiles.length) {
                document.getElementById('imagePreview').classList.remove('active');
                imageControls.style.display = 'none';
                document.getElementById('imageResults').classList.remove('active');
                state.convertedImages.forEach(img => URL.revokeObjectURL(img.url));
                state.convertedImages = [];
            }
        }
    };

    function handleImageFiles(files) {
        if (!files.length) return;
        const validFiles = files.filter(f => f.type.startsWith('image/'));
        if (validFiles.length !== files.length) showToast('Some files were skipped (invalid format)', 'error');
        if (validFiles.length) {
            state.imageFiles.push(...validFiles);
            updateImagePreview();
            document.getElementById('imagePreview').classList.add('active');
            imageControls.style.display = 'flex';
            showToast(`Added ${validFiles.length} image(s)`, 'success');
        }
    }

    document.querySelectorAll('.image-converter .format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.image-converter .format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentImageFormat = btn.dataset.format;
        });
    });

    qualitySlider.oninput = () => qualityValue.textContent = qualitySlider.value + '%';

    async function convertImage(file, format, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (format === 'jpeg') { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
                ctx.drawImage(img, 0, 0);
                const mime = format === 'bmp' ? 'image/bmp' : `image/${format}`;
                canvas.toBlob(blob => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ url: URL.createObjectURL(blob), blob, name: file.name.replace(/\.[^/.]+$/, '') + '.' + format });
                }, mime, quality);
            };
            img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Image load failed')); };
            img.src = objectUrl;
        });
    }

    convertImagesBtn.onclick = async () => {
        if (!state.imageFiles.length) return;
        setButtonLoading(convertImagesBtn, true);
        const prog = document.getElementById('imageProgress');
        const fill = document.getElementById('imageProgressFill');
        const text = document.getElementById('imageProgressText');
        const resGrid = document.getElementById('imageResultGrid');
        
        state.convertedImages.forEach(img => URL.revokeObjectURL(img.url));
        state.convertedImages = [];
        
        prog.classList.add('active');
        document.getElementById('imageResults').classList.remove('active');
        
        for (let i = 0; i < state.imageFiles.length; i++) {
            const pct = ((i + 1) / state.imageFiles.length) * 100;
            fill.style.width = pct + '%';
            text.textContent = `Converting ${i+1}/${state.imageFiles.length} (${Math.round(pct)}%)`;
            try {
                const result = await convertImage(state.imageFiles[i], state.currentImageFormat, qualitySlider.value / 100);
                state.convertedImages.push(result);
            } catch (err) {
                showToast(`Failed: ${state.imageFiles[i].name}`, 'error');
            }
        }
        
        prog.classList.remove('active');
        setButtonLoading(convertImagesBtn, false);
        
        resGrid.innerHTML = state.convertedImages.map((img, idx) => `<div class="result-item" onclick="window.downloadSingleImage(${idx})"><img src="${img.url}"><div class="result-overlay">${img.name}</div></div>`).join('');
        document.getElementById('imageResults').classList.add('active');
        showToast(`Converted ${state.convertedImages.length} images!`, 'success');
    };

    window.downloadSingleImage = (idx) => {
        const img = state.convertedImages[idx];
        const a = document.createElement('a');
        a.href = img.url;
        a.download = img.name;
        a.click();
    };

    document.getElementById('downloadAllImages').onclick = async () => {
        if (!state.convertedImages.length) return;
        const zip = new JSZip();
        const folder = zip.folder("converted_images");
        for (const img of state.convertedImages) {
            const blob = await fetch(img.url).then(r => r.blob());
            folder.file(img.name, blob);
        }
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `converted_${Date.now()}.zip`);
        showToast(`ZIP with ${state.convertedImages.length} files downloaded`, 'success');
    };

    // ==================== PDF TO IMAGES ====================
    const pdfToImageZone = document.getElementById('pdfToImageZone');
    const pdfToImageInput = document.getElementById('pdfToImageInput');
    const pdfPreview = document.getElementById('pdfToImagePreview');
    
    async function renderPdfToImages(pdfFile, format, scale, onProgress) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
            const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, 0.92));
            images.push({ url: URL.createObjectURL(blob), blob, name: `page_${i}.${format}` });
            if (onProgress) onProgress(i, pdf.numPages);
        }
        return images;
    }

    function loadPdfFile(file) {
        if (!file || file.type !== 'application/pdf') {
            showToast('Invalid PDF file', 'error');
            return;
        }
        state.pdfToImageFile = file;
        pdfPreview.innerHTML = `<div class="preview-item"><div class="preview-thumb" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem;"><i class="ri-file-pdf-line"></i></div><div class="preview-info"><div class="preview-name">${escapeHtml(file.name)}</div><div class="preview-size">${formatFileSize(file.size)}</div></div><button class="preview-remove" onclick="window.removePdfFile()"><i class="ri-close-line"></i></button></div>`;
        pdfPreview.classList.add('active');
        document.getElementById('pdfToImageControls').style.display = 'flex';
    }

    window.removePdfFile = () => {
        if (state.pdfToImageFile) state.pdfToImageFile = null;
        pdfPreview.innerHTML = '';
        pdfPreview.classList.remove('active');
        document.getElementById('pdfToImageControls').style.display = 'none';
        document.getElementById('pdfToImageResults').classList.remove('active');
        if (state.extractedImages.length) {
            state.extractedImages.forEach(img => URL.revokeObjectURL(img.url));
            state.extractedImages = [];
        }
    };

    document.querySelectorAll('#pdfToImageControls .format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#pdfToImageControls .format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentPdfImageFormat = btn.dataset.format;
        });
    });

    const pdfScaleSlider = document.getElementById('pdfScaleSlider');
    const pdfScaleValue = document.getElementById('pdfScaleValue');
    pdfScaleSlider.oninput = () => pdfScaleValue.textContent = pdfScaleSlider.value + 'x';

    document.getElementById('convertPdfBtn').onclick = async () => {
        if (!state.pdfToImageFile) { showToast('Please select a PDF file', 'error'); return; }
        const btn = document.getElementById('convertPdfBtn');
        setButtonLoading(btn, true);
        const prog = document.getElementById('pdfToImageProgress');
        const fill = document.getElementById('pdfToImageProgressFill');
        const text = document.getElementById('pdfToImageProgressText');
        const resCont = document.getElementById('pdfToImageResults');
        
        prog.classList.add('active');
        resCont.classList.remove('active');
        
        try {
            state.extractedImages.forEach(img => URL.revokeObjectURL(img.url));
            state.extractedImages = await renderPdfToImages(state.pdfToImageFile, state.currentPdfImageFormat, parseFloat(pdfScaleSlider.value), (current, total) => {
                const pct = (current / total) * 100;
                fill.style.width = pct + '%';
                text.textContent = `Page ${current}/${total} (${Math.round(pct)}%)`;
            });
            fill.style.width = '100%';
            text.textContent = 'Complete!';
            prog.classList.remove('active');
            setButtonLoading(btn, false);
            
            resCont.innerHTML = `<div class="result-grid">${state.extractedImages.map((img, idx) => `<div class="result-item" onclick="window.downloadExtractedPage(${idx})"><img src="${img.url}"><div class="result-overlay">${img.name}</div></div>`).join('')}</div><button class="download-all-btn" id="downloadAllExtractedPages"><i class="ri-download-2-line"></i> Download All Pages (ZIP)</button>`;
            resCont.classList.add('active');
            
            document.getElementById('downloadAllExtractedPages').onclick = async () => {
                const zip = new JSZip();
                const folder = zip.folder("pdf_pages");
                for (const img of state.extractedImages) {
                    const blob = await fetch(img.url).then(r => r.blob());
                    folder.file(img.name, blob);
                }
                const content = await zip.generateAsync({ type: "blob" });
                saveAs(content, `pdf_pages_${Date.now()}.zip`);
                showToast(`ZIP with ${state.extractedImages.length} pages downloaded`, 'success');
            };
            showToast('PDF extracted successfully!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            setButtonLoading(btn, false);
            prog.classList.remove('active');
        }
    };
    
    window.downloadExtractedPage = (idx) => {
        const a = document.createElement('a');
        a.href = state.extractedImages[idx].url;
        a.download = state.extractedImages[idx].name;
        a.click();
    };

    // ==================== IMAGES TO PDF ====================
    const imagesToPdfZone = document.getElementById('imagesToPdfZone');
    const imagesToPdfInput = document.getElementById('imagesToPdfInput');
    const imagesToPdfList = document.getElementById('imagesToPdfList');
    
    function updateImagesToPdfPreview() {
        const oldThumbs = document.querySelectorAll('#imagesToPdfList .preview-thumb');
        oldThumbs.forEach(img => { if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
        
        imagesToPdfList.innerHTML = state.imagesToPdfFiles.map((file, idx) => {
            const previewUrl = URL.createObjectURL(file);
            return `<div class="preview-item" draggable="true" data-idx="${idx}"><img src="${previewUrl}" class="preview-thumb"><div class="preview-info"><div class="preview-name">${escapeHtml(file.name)}</div><div class="preview-size">${formatFileSize(file.size)}</div></div><button class="preview-remove" onclick="window.removeFromPdf(${idx})"><i class="ri-close-line"></i></button></div>`;
        }).join('');
        attachDragEvents();
    }

    function attachDragEvents() {
        let dragSrc = null;
        const items = document.querySelectorAll('#imagesToPdfList .preview-item');
        items.forEach(item => {
            item.setAttribute('draggable', 'true');
            item.ondragstart = (e) => { dragSrc = item; e.dataTransfer.effectAllowed = 'move'; item.style.opacity = '0.5'; };
            item.ondragend = (e) => { item.style.opacity = '1'; if (dragSrc) { const fromIdx = parseInt(dragSrc.dataset.idx); const toIdx = parseInt(item.dataset.idx); if (fromIdx !== toIdx && !isNaN(fromIdx) && !isNaN(toIdx)) { const moved = state.imagesToPdfFiles.splice(fromIdx, 1)[0]; state.imagesToPdfFiles.splice(toIdx, 0, moved); updateImagesToPdfPreview(); } dragSrc = null; } };
            item.ondragover = (e) => e.preventDefault();
            item.ondrop = (e) => { e.preventDefault(); if (dragSrc && dragSrc !== item) { const fromIdx = parseInt(dragSrc.dataset.idx); const toIdx = parseInt(item.dataset.idx); if (!isNaN(fromIdx) && !isNaN(toIdx)) { const moved = state.imagesToPdfFiles.splice(fromIdx, 1)[0]; state.imagesToPdfFiles.splice(toIdx, 0, moved); updateImagesToPdfPreview(); } } };
        });
    }

    window.removeFromPdf = (idx) => {
        state.imagesToPdfFiles.splice(idx, 1);
        updateImagesToPdfPreview();
        if (!state.imagesToPdfFiles.length) {
            document.getElementById('imagesToPdfPreview').classList.remove('active');
            document.getElementById('imagesToPdfControls').style.display = 'none';
            document.getElementById('imagesToPdfResults').classList.remove('active');
        }
    };

    function addImagesToPdf(files) {
        const valid = files.filter(f => f.type.startsWith('image/'));
        if (!valid.length) { showToast('No valid images', 'error'); return; }
        state.imagesToPdfFiles.push(...valid);
        updateImagesToPdfPreview();
        document.getElementById('imagesToPdfPreview').classList.add('active');
        document.getElementById('imagesToPdfControls').style.display = 'flex';
        showToast(`Added ${valid.length} image(s)`, 'success');
    }

    document.querySelectorAll('#imagesToPdfControls .format-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#imagesToPdfControls .format-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.pdfPageSize = btn.dataset.size;
        });
    });

    document.getElementById('createPdfBtn').onclick = async () => {
        if (!state.imagesToPdfFiles.length) return;
        const btn = document.getElementById('createPdfBtn');
        setButtonLoading(btn, true);
        const prog = document.getElementById('imagesToPdfProgress');
        const fill = document.getElementById('imagesToPdfProgressFill');
        const text = document.getElementById('imagesToPdfProgressText');
        const resCont = document.getElementById('imagesToPdfResults');
        
        prog.classList.add('active');
        resCont.classList.remove('active');
        
        try {
            const { jsPDF } = window.jspdf;
            let pdf = null;
            for (let i = 0; i < state.imagesToPdfFiles.length; i++) {
                const pct = ((i + 1) / state.imagesToPdfFiles.length) * 100;
                fill.style.width = pct + '%';
                text.textContent = `Adding image ${i+1}/${state.imagesToPdfFiles.length} (${Math.round(pct)}%)`;
                
                const imgUrl = URL.createObjectURL(state.imagesToPdfFiles[i]);
                const img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = reject;
                    image.src = imgUrl;
                });
                
                if (state.pdfPageSize === 'fit') {
                    if (!pdf) pdf = new jsPDF({ orientation: img.width > img.height ? 'l' : 'p', unit: 'px', format: [img.width, img.height] });
                    else pdf.addPage([img.width, img.height], img.width > img.height ? 'l' : 'p');
                    pdf.addImage(imgUrl, 'JPEG', 0, 0, img.width, img.height);
                } else {
                    if (!pdf) pdf = new jsPDF('p', 'mm', state.pdfPageSize === 'a4' ? 'a4' : 'letter');
                    else pdf.addPage(state.pdfPageSize === 'a4' ? 'a4' : 'letter');
                    const pageWidth = pdf.internal.pageSize.getWidth();
                    const pageHeight = pdf.internal.pageSize.getHeight();
                    const ratio = Math.min(pageWidth / img.width, pageHeight / img.height);
                    const w = img.width * ratio, h = img.height * ratio;
                    const x = (pageWidth - w) / 2, y = (pageHeight - h) / 2;
                    pdf.addImage(imgUrl, 'JPEG', x, y, w, h);
                }
                URL.revokeObjectURL(imgUrl);
            }
            const blob = pdf.output('blob');
            const url = URL.createObjectURL(blob);
            prog.classList.remove('active');
            setButtonLoading(btn, false);
            resCont.innerHTML = `<div style="text-align:center;padding:1.5rem;background:var(--surface-alt);border-radius:16px;border:1px solid var(--border);"><div style="font-size:2.5rem;margin-bottom:0.5rem;"><i class="ri-file-pdf-line"></i></div><div style="font-weight:600;">PDF Created</div><div style="color:var(--text-muted);font-size:0.8rem;margin-top:0.25rem;">${state.imagesToPdfFiles.length} pages • ${formatFileSize(blob.size)}</div></div><button class="download-all-btn" style="margin-top:1rem;" onclick="window.downloadFinalPdf('${url}')"><i class="ri-download-2-line"></i> Download PDF</button>`;
            resCont.classList.add('active');
            showToast('PDF created successfully!', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
            setButtonLoading(btn, false);
            prog.classList.remove('active');
        }
    };
    
    window.downloadFinalPdf = (url) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = `merged_${Date.now()}.pdf`;
        a.click();
    };

    function escapeHtml(str) { return str.replace(/[&<>]/g, function(m) { if (m === '&') return '&amp;'; if (m === '<') return '&lt;'; if (m === '>') return '&gt;'; return m; }); }

    function preventDefault(e) { e.preventDefault(); e.stopPropagation(); }
    [imageZone, pdfToImageZone, imagesToPdfZone].forEach(zone => {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, preventDefault));
        zone.addEventListener('dragover', () => zone.classList.add('dragover'));
        zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
        zone.addEventListener('drop', () => zone.classList.remove('dragover'));
    });
    
    imageZone.addEventListener('drop', (e) => { handleImageFiles(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); });
    pdfToImageZone.addEventListener('drop', (e) => { const file = Array.from(e.dataTransfer.files).find(f => f.type === 'application/pdf'); if (file) loadPdfFile(file); });
    imagesToPdfZone.addEventListener('drop', (e) => { addImagesToPdf(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))); });
    
    imageInput.onchange = (e) => handleImageFiles(Array.from(e.target.files));
    pdfToImageInput.onchange = (e) => { if (e.target.files[0]) loadPdfFile(e.target.files[0]); };
    imagesToPdfInput.onchange = (e) => { if (e.target.files.length) addImagesToPdf(Array.from(e.target.files)); };
    
    showToast('Welcome! All conversions are 100% local & private', 'info');
