// Initialize PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Debug flag
console.log('%c=== PDF MERGER DEBUGGER ENABLED ===', 'color: green; font-weight: bold; font-size: 14px;');
console.log('Debug mode is active. All operations will be logged to the console.');
console.log('Type "debugInfo()" in console to see current state summary.');

// Debug helper function
window.debugInfo = function () {
  console.log('\n=== CURRENT STATE ===');
  console.log('Total pages loaded:', pageManager.getAllPages().length);
  console.log('Selected pages:', pageManager.getSelectedPages().length);
  console.log('Original files:', pageManager.originalFiles.length);
  pageManager.originalFiles.forEach((file, i) => {
    console.log(`  File ${i}: ${file.name} (${(file.size / 1048576).toFixed(2)} MB)`);
  });
  if (performance.memory) {
    console.log('Memory usage:', (performance.memory.usedJSHeapSize / 1048576).toFixed(2), 'MB');
    console.log('Memory limit:', (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2), 'MB');
  }
  console.log('===================\n');
};

// Page Manager Object
class PDFPageManager {
  constructor() {
    this.pages = [];
    this.nextId = 1;
    this.originalFiles = [];
  }

  addPage(pageData) {
    const page = {
      id: this.nextId++,
      canvas: pageData.canvas,
      pdfPage: pageData.pdfPage,
      originalPageNum: pageData.originalPageNum,
      rotation: pageData.rotation || 0,
      selected: false,
      fileName: pageData.fileName,
      fileIndex: pageData.fileIndex,
      arrayBuffer: pageData.arrayBuffer
    };
    this.pages.push(page);
    return page;
  }

  removePage(id) {
    this.pages = this.pages.filter(p => p.id !== id);
  }

  getPage(id) {
    return this.pages.find(p => p.id === id);
  }

  rotatePage(id, degrees) {
    const page = this.getPage(id);
    if (page) {
      page.rotation = (page.rotation + degrees) % 360;
    }
  }

  toggleSelection(id) {
    const page = this.getPage(id);
    if (page) {
      page.selected = !page.selected;
    }
  }

  selectAll(selected) {
    this.pages.forEach(p => p.selected = selected);
  }

  getSelectedPages() {
    return this.pages.filter(p => p.selected);
  }

  getAllPages() {
    return this.pages;
  }

  reorderPages(oldIndex, newIndex) {
    const [movedPage] = this.pages.splice(oldIndex, 1);
    this.pages.splice(newIndex, 0, movedPage);
  }

  clear() {
    this.pages = [];
    this.originalFiles = [];
    this.nextId = 1;
  }
}

// Global instances
const pageManager = new PDFPageManager();
let draggedElement = null;
let draggedIndex = null;

// DOM Elements
const uploadZone = document.getElementById('uploadZone');
const pagesGrid = document.getElementById('pagesGrid');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const browseBtn = document.getElementById('browseBtn');
const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const mergeTab = document.getElementById('mergeTab');
const extractTab = document.getElementById('extractTab');
const mergeContent = document.getElementById('mergeContent');
const extractContent = document.getElementById('extractContent');
const mergeBtn = document.getElementById('mergeBtn');
const extractBtn = document.getElementById('extractBtn');
const mergeFilename = document.getElementById('mergeFilename');
const extractFilename = document.getElementById('extractFilename');
const mergeSinglePdf = document.getElementById('mergeSinglePdf');
const totalPagesSpan = document.getElementById('totalPages');
const selectedPagesSpan = document.getElementById('selectedPages');

// Event Listeners
uploadBtn.addEventListener('click', () => fileInput.click());
browseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
selectAllCheckbox.addEventListener('change', handleSelectAll);
mergeTab.addEventListener('click', () => switchTab('merge'));
extractTab.addEventListener('click', () => switchTab('extract'));
mergeBtn.addEventListener('click', handleMerge);
extractBtn.addEventListener('click', handleExtract);

// Drag and drop for upload zone
uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('drag-over');
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.classList.remove('drag-over');
});

uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
});

// Handle file selection
function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  processFiles(files);
  fileInput.value = ''; // Reset input
}

// Process uploaded files
async function processFiles(files) {
  console.log('=== PROCESSING FILES ===');
  console.log(`Number of files: ${files.length}`);

  // Validate all files are PDFs
  const invalidFiles = files.filter(f => !f.type.includes('pdf'));
  if (invalidFiles.length > 0) {
    console.error('Invalid files detected:', invalidFiles);
    alert('Error: Please upload only PDF files.');
    return;
  }

  if (files.length === 0) return;

  // Set default filename to first file's name
  const firstName = files[0].name.replace('.pdf', '');
  mergeFilename.value = firstName;
  extractFilename.value = firstName;

  // Hide upload zone, show grid
  uploadZone.classList.add('hidden');
  pagesGrid.classList.remove('hidden');

  // Process each PDF
  for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
    const file = files[fileIndex];
    console.log(`\n--- Processing file ${fileIndex + 1}/${files.length}: ${file.name} (${(file.size / 1048576).toFixed(2)} MB) ---`);
    pageManager.originalFiles.push(file);
    await loadPDF(file, fileIndex);
  }

  console.log('=== ALL FILES PROCESSED ===');
  updateStats();
}

// Load PDF and render pages
async function loadPDF(file, fileIndex) {
  const fileStartTime = performance.now();

  try {
    console.log('Reading file as array buffer...');
    const arrayBuffer = await file.arrayBuffer();
    console.log(`✓ Array buffer created (${arrayBuffer.byteLength} bytes)`);

    console.log('Loading PDF document...');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log(`✓ PDF loaded: ${pdf.numPages} pages`);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const pageStartTime = performance.now();

      if (pageNum % 10 === 0 || pageNum === 1 || pageNum === pdf.numPages) {
        console.log(`Loading page ${pageNum}/${pdf.numPages}...`);
      }

      const page = await pdf.getPage(pageNum);

      const pageData = {
        canvas: null,
        pdfPage: page,
        originalPageNum: pageNum,
        rotation: 0,
        fileName: file.name,
        fileIndex,
        arrayBuffer: arrayBuffer
      };

      const pageObj = pageManager.addPage(pageData);
      await addPageToGrid(pageObj);

      const pageEndTime = performance.now();
      if (pageNum % 10 === 0 || pageNum === 1 || pageNum === pdf.numPages) {
        console.log(`✓ Page ${pageNum} rendered in ${(pageEndTime - pageStartTime).toFixed(2)}ms`);
      }

      // Check memory every 25 pages
      if (pageNum % 25 === 0 && performance.memory) {
        console.log(`Memory at page ${pageNum}: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
      }
    }

    const fileEndTime = performance.now();
    console.log(`✓ File "${file.name}" completed in ${((fileEndTime - fileStartTime) / 1000).toFixed(2)}s`);
  } catch (error) {
    console.error(`✗ ERROR loading PDF "${file.name}":`, error);
    console.error('Stack trace:', error.stack);
    throw error;
  }
}

// Render PDF page to canvas
async function renderPage(pdfPage, rotation) {
  const viewport = pdfPage.getViewport({ scale: 0.5, rotation });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.height = viewport.height;
  canvas.width = viewport.width;
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';
  canvas.style.display = 'block';

  const renderContext = {
    canvasContext: context,
    viewport: viewport
  };

  try {
    await pdfPage.render(renderContext).promise;
  } catch (error) {
    console.error('Error rendering page:', error);
  }

  return canvas;
}

// Add page to grid
async function addPageToGrid(pageObj) {
  const pageDiv = document.createElement('div');
  pageDiv.className = 'pdf-page bg-white rounded-lg shadow-md overflow-hidden cursor-move relative';
  pageDiv.dataset.pageId = pageObj.id;
  pageDiv.draggable = true;

  const currentIndex = pageManager.pages.findIndex(p => p.id === pageObj.id);

  // Create main container
  const container = document.createElement('div');
  container.className = 'relative';

  // Page number badge (top left)
  const pageNumberBadge = document.createElement('div');
  pageNumberBadge.className = 'page-number-badge absolute bottom-5 right-5 z-10';
  pageNumberBadge.textContent = currentIndex + 1;

  // Checkbox (top right)
  const checkboxContainer = document.createElement('div');
  checkboxContainer.className = 'absolute top-5 right-5 z-10';
  checkboxContainer.innerHTML = `
    <input type="checkbox" class="page-checkbox w-5 h-5 text-blue-600 rounded cursor-pointer" 
        ${pageObj.selected ? 'checked' : ''}>
  `;

  // Canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'p-2 flex items-center justify-center bg-gray-100';
  canvasContainer.style.minHeight = '120px';

  const canvasWrapper = document.createElement('div');
  canvasWrapper.style.maxWidth = '100%';
  canvasWrapper.style.height = 'auto';

  // Render the page
  const canvas = await renderPage(pageObj.pdfPage, pageObj.rotation);
  pageObj.canvas = canvas;
  canvasWrapper.appendChild(canvas);
  canvasContainer.appendChild(canvasWrapper);

  // Bottom controls (rotate and delete)
  const bottomControls = document.createElement('div');
  bottomControls.className = 'page-controls absolute bottom-5 left-1/2 transform -translate-x-1/2 flex gap-2';
  bottomControls.innerHTML = `
    <button class="rotate-btn bg-white hover:bg-gray-100 p-2 rounded-full shadow text-gray-700 w-7 h-7 flex items-center justify-center">
        <i class="bi bi-arrow-clockwise"></i>
    </button>
    <button class="delete-btn bg-red-500 hover:bg-red-600 p-2 rounded-full shadow text-white w-7 h-7 flex items-center justify-center">
        <i class="bi bi-trash"></i>
    </button>
  `;

  container.appendChild(pageNumberBadge);
  container.appendChild(checkboxContainer);
  container.appendChild(canvasContainer);
  container.appendChild(bottomControls);
  pageDiv.appendChild(container);

  // Add event listeners
  const checkbox = pageDiv.querySelector('.page-checkbox');
  const rotateBtn = pageDiv.querySelector('.rotate-btn');
  const deleteBtn = pageDiv.querySelector('.delete-btn');

  checkbox.addEventListener('change', (e) => {
    e.stopPropagation();
    pageManager.toggleSelection(pageObj.id);
    pageDiv.classList.toggle('selected', pageManager.getPage(pageObj.id).selected);
    updateStats();
  });

  rotateBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    pageManager.rotatePage(pageObj.id, 90);
    const page = pageManager.getPage(pageObj.id);
    const newCanvas = await renderPage(page.pdfPage, page.rotation);
    page.canvas = newCanvas;
    canvasWrapper.innerHTML = '';
    canvasWrapper.appendChild(newCanvas);
  });

  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    pageManager.removePage(pageObj.id);
    pageDiv.remove();
    updatePageNumbers();
    updateStats();
  });

  // Drag and drop for reordering
  pageDiv.addEventListener('dragstart', handleDragStart);
  pageDiv.addEventListener('dragover', handleDragOver);
  pageDiv.addEventListener('drop', handleDrop);
  pageDiv.addEventListener('dragend', handleDragEnd);

  // Find the grid container within pagesGrid (last element with 'grid' class)
  const gridContainer = pagesGrid.querySelector('[class*="grid-cols"]') || pagesGrid;
  gridContainer.appendChild(pageDiv);
}

// Drag and drop handlers
function handleDragStart(e) {
  draggedElement = e.currentTarget;
  const gridContainer = pagesGrid.querySelector('[class*="grid-cols"]') || pagesGrid;
  draggedIndex = Array.from(gridContainer.children).indexOf(draggedElement);
  e.currentTarget.classList.add('dragging');
}

function handleDragOver(e) {
  e.preventDefault();
}

function handleDrop(e) {
  e.preventDefault();
  const dropTarget = e.currentTarget;
  const gridContainer = pagesGrid.querySelector('[class*="grid-cols"]') || pagesGrid;
  const dropIndex = Array.from(gridContainer.children).indexOf(dropTarget);

  if (draggedElement && draggedElement !== dropTarget) {
    pageManager.reorderPages(draggedIndex, dropIndex);

    if (draggedIndex < dropIndex) {
      dropTarget.after(draggedElement);
    } else {
      dropTarget.before(draggedElement);
    }

    updatePageNumbers();
  }
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  draggedElement = null;
  draggedIndex = null;
}

// Update page numbers
function updatePageNumbers() {
  const gridContainer = pagesGrid.querySelector('[class*="grid-cols"]') || pagesGrid;
  const pageElements = gridContainer.querySelectorAll('.pdf-page');
  pageElements.forEach((el, index) => {
    const pageNumBadge = el.querySelector('.page-number-badge');
    pageNumBadge.textContent = index + 1;
  });
}

// Handle select all
function handleSelectAll(e) {
  pageManager.selectAll(e.target.checked);
  document.querySelectorAll('.page-checkbox').forEach(cb => {
    cb.checked = e.target.checked;
  });
  document.querySelectorAll('.pdf-page').forEach(page => {
    page.classList.toggle('selected', e.target.checked);
  });
  updateStats();
}

// Switch tabs
function switchTab(tab) {
  if (tab === 'merge') {
    mergeTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    mergeTab.classList.remove('text-gray-600');
    extractTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    extractTab.classList.add('text-gray-600');
    mergeContent.classList.remove('hidden');
    extractContent.classList.add('hidden');
  } else {
    extractTab.classList.add('text-blue-600', 'border-b-2', 'border-blue-600');
    extractTab.classList.remove('text-gray-600');
    mergeTab.classList.remove('text-blue-600', 'border-b-2', 'border-blue-600');
    mergeTab.classList.add('text-gray-600');
    extractContent.classList.remove('hidden');
    mergeContent.classList.add('hidden');
  }
}

// Update statistics
function updateStats() {
  totalPagesSpan.textContent = pageManager.getAllPages().length;
  selectedPagesSpan.textContent = pageManager.getSelectedPages().length;
}

// Handle merge (OPTIMIZED VERSION)
async function handleMerge() {
  console.log('=== MERGE OPERATION STARTED ===');
  const startTime = performance.now();

  const selectedPages = pageManager.getSelectedPages();
  const pagesToMerge = selectedPages.length > 0 ? selectedPages : pageManager.getAllPages();

  console.log(`Total pages to merge: ${pagesToMerge.length}`);
  console.log('Selected pages:', selectedPages.length > 0 ? 'Yes' : 'No (using all)');

  if (pagesToMerge.length === 0) {
    alert('No pages to merge');
    return;
  }

  // Disable button and show progress
  mergeBtn.disabled = true;
  mergeBtn.textContent = 'Merging...';

  try {
    console.log('Creating new PDF document...');
    const mergedPdf = await PDFLib.PDFDocument.create();
    console.log('✓ New PDF document created');

    // ==================== PERFORMANCE OPTIMIZATION ====================
    // Pre-load all unique source PDFs ONCE instead of loading them repeatedly
    console.log('\n=== Pre-loading source PDFs (OPTIMIZATION) ===');
    const loadedPdfs = new Map(); // Cache: fileIndex -> loaded PDF
    const uniqueFileIndices = [...new Set(pagesToMerge.map(p => p.fileIndex))];

    for (const fileIndex of uniqueFileIndices) {
      const originalFile = pageManager.originalFiles[fileIndex];
      console.log(`Loading ${originalFile.name}...`);
      const arrayBuffer = await originalFile.arrayBuffer();
      const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
      loadedPdfs.set(fileIndex, sourcePdf);
      console.log(`✓ Loaded (${sourcePdf.getPageCount()} pages)`);
    }
    console.log(`✓ All ${uniqueFileIndices.length} source file(s) pre-loaded\n`);
    // ==================================================================

    // Now process pages using cached PDFs (MUCH FASTER!)
    for (let i = 0; i < pagesToMerge.length; i++) {
      const page = pagesToMerge[i];
      const pageStartTime = performance.now();

      // Log every 10 pages to reduce console spam
      if (i % 10 === 0 || i === 0 || i === pagesToMerge.length - 1) {
        console.log(`\n--- Processing page ${i + 1}/${pagesToMerge.length} ---`);
        console.log(`Page ID: ${page.id}, Original page: ${page.originalPageNum}, File: ${page.fileName}`);
      }

      // Update button with progress
      mergeBtn.textContent = `Merging ${i + 1}/${pagesToMerge.length}...`;

      try {
        // Use the cached PDF (no loading/parsing needed!)
        const sourcePdf = loadedPdfs.get(page.fileIndex);

        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [page.originalPageNum - 1]);

        if (page.rotation !== 0) {
          copiedPage.setRotation(PDFLib.degrees(page.rotation));
        }

        mergedPdf.addPage(copiedPage);

        const pageEndTime = performance.now();
        if (i % 10 === 0 || i === 0 || i === pagesToMerge.length - 1) {
          console.log(`✓ Page ${i + 1} completed in ${(pageEndTime - pageStartTime).toFixed(2)}ms`);

          // Log memory if available
          if (performance.memory) {
            console.log(`Memory: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
          }
        }
      } catch (pageError) {
        console.error(`✗ ERROR processing page ${i + 1}:`, pageError);
        throw new Error(`Failed on page ${i + 1}: ${pageError.message}`);
      }
    }

    console.log('\n=== Saving merged PDF ===');
    const saveStartTime = performance.now();
    const pdfBytes = await mergedPdf.save();
    const saveEndTime = performance.now();
    console.log(`✓ PDF saved (${pdfBytes.length} bytes) in ${(saveEndTime - saveStartTime).toFixed(2)}ms`);

    const filename = mergeFilename.value.trim() || 'merged-document';
    console.log(`Downloading as: ${filename}.pdf`);
    downloadFile(pdfBytes, `${filename}.pdf`, 'application/pdf');

    const endTime = performance.now();
    console.log(`\n=== MERGE COMPLETED SUCCESSFULLY ===`);
    console.log(`Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
  } catch (error) {
    console.error('\n=== MERGE FAILED ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    alert(`Error merging PDF: ${error.message}\n\nCheck console for details.`);
  } finally {
    mergeBtn.disabled = false;
    mergeBtn.textContent = 'Download Merged PDF';
  }
}

// Handle extract (OPTIMIZED VERSION)
async function handleExtract() {
  console.log('=== EXTRACT OPERATION STARTED ===');
  const startTime = performance.now();

  const selectedPages = pageManager.getSelectedPages();
  const pagesToExtract = selectedPages.length > 0 ? selectedPages : pageManager.getAllPages();

  console.log(`Total pages to extract: ${pagesToExtract.length}`);
  console.log('Selected pages:', selectedPages.length > 0 ? 'Yes' : 'No (using all)');

  if (pagesToExtract.length === 0) {
    alert('No pages to extract');
    return;
  }

  // Disable button and show progress
  extractBtn.disabled = true;
  extractBtn.textContent = 'Extracting...';

  try {
    const mergeAsSingle = mergeSinglePdf.checked;
    console.log(`Extract mode: ${mergeAsSingle ? 'Single PDF' : 'Individual PDFs'}`);

    // ==================== PERFORMANCE OPTIMIZATION ====================
    // Pre-load all unique source PDFs ONCE
    console.log('\n=== Pre-loading source PDFs (OPTIMIZATION) ===');
    const loadedPdfs = new Map();
    const uniqueFileIndices = [...new Set(pagesToExtract.map(p => p.fileIndex))];

    for (const fileIndex of uniqueFileIndices) {
      const originalFile = pageManager.originalFiles[fileIndex];
      console.log(`Loading ${originalFile.name}...`);
      const arrayBuffer = await originalFile.arrayBuffer();
      const sourcePdf = await PDFLib.PDFDocument.load(arrayBuffer);
      loadedPdfs.set(fileIndex, sourcePdf);
      console.log(`✓ Loaded (${sourcePdf.getPageCount()} pages)`);
    }
    console.log(`✓ All ${uniqueFileIndices.length} source file(s) pre-loaded\n`);
    // ==================================================================

    if (mergeAsSingle) {
      // Extract as single PDF
      console.log('Creating extracted PDF document...');
      const extractedPdf = await PDFLib.PDFDocument.create();
      console.log('✓ New PDF document created');

      for (let i = 0; i < pagesToExtract.length; i++) {
        const page = pagesToExtract[i];

        if (i % 10 === 0 || i === 0 || i === pagesToExtract.length - 1) {
          console.log(`\n--- Processing page ${i + 1}/${pagesToExtract.length} ---`);
        }

        // Update button with progress
        extractBtn.textContent = `Extracting ${i + 1}/${pagesToExtract.length}...`;

        try {
          const sourcePdf = loadedPdfs.get(page.fileIndex);
          const [copiedPage] = await extractedPdf.copyPages(sourcePdf, [page.originalPageNum - 1]);

          if (page.rotation !== 0) {
            copiedPage.setRotation(PDFLib.degrees(page.rotation));
          }

          extractedPdf.addPage(copiedPage);

          if (i % 10 === 0 || i === 0 || i === pagesToExtract.length - 1) {
            if (performance.memory) {
              console.log(`Memory: ${(performance.memory.usedJSHeapSize / 1048576).toFixed(2)} MB`);
            }
          }
        } catch (pageError) {
          console.error(`✗ ERROR processing page ${i + 1}:`, pageError);
          throw new Error(`Failed on page ${i + 1}: ${pageError.message}`);
        }
      }

      console.log('\n=== Saving extracted PDF ===');
      const saveStartTime = performance.now();
      const pdfBytes = await extractedPdf.save();
      const saveEndTime = performance.now();
      console.log(`✓ PDF saved (${pdfBytes.length} bytes) in ${(saveEndTime - saveStartTime).toFixed(2)}ms`);

      const filename = extractFilename.value.trim() || 'extracted-pages';
      console.log(`Downloading as: ${filename}.pdf`);
      downloadFile(pdfBytes, `${filename}.pdf`, 'application/pdf');
    } else {
      // Extract as individual PDFs
      if (pagesToExtract.length === 1) {
        console.log('Extracting single page as PDF...');
        const page = pagesToExtract[0];
        const singlePdf = await PDFLib.PDFDocument.create();

        const sourcePdf = loadedPdfs.get(page.fileIndex);
        const [copiedPage] = await singlePdf.copyPages(sourcePdf, [page.originalPageNum - 1]);

        if (page.rotation !== 0) {
          copiedPage.setRotation(PDFLib.degrees(page.rotation));
        }

        singlePdf.addPage(copiedPage);

        const pdfBytes = await singlePdf.save();
        const filename = extractFilename.value.trim() || 'extracted-page';
        const pageIndex = pageManager.getAllPages().findIndex(p => p.id === page.id);
        downloadFile(pdfBytes, `${filename}_page-${pageIndex + 1}.pdf`, 'application/pdf');

        console.log('✓ Single page extracted');
      } else {
        // Multiple pages - download as ZIP
        console.log('Extracting multiple pages as ZIP...');
        const zip = new JSZip();
        const filename = extractFilename.value.trim() || 'extracted-pages';

        for (let i = 0; i < pagesToExtract.length; i++) {
          const page = pagesToExtract[i];

          if (i % 10 === 0 || i === 0 || i === pagesToExtract.length - 1) {
            console.log(`\n--- Creating PDF ${i + 1}/${pagesToExtract.length} ---`);
          }

          // Update button with progress
          extractBtn.textContent = `Extracting ${i + 1}/${pagesToExtract.length}...`;

          try {
            const singlePdf = await PDFLib.PDFDocument.create();

            const sourcePdf = loadedPdfs.get(page.fileIndex);
            const [copiedPage] = await singlePdf.copyPages(sourcePdf, [page.originalPageNum - 1]);

            if (page.rotation !== 0) {
              copiedPage.setRotation(PDFLib.degrees(page.rotation));
            }

            singlePdf.addPage(copiedPage);

            const pdfBytes = await singlePdf.save();
            const pageIndex = pageManager.getAllPages().findIndex(p => p.id === page.id);
            const pdfFilename = `${filename}_page-${pageIndex + 1}.pdf`;

            zip.file(pdfFilename, pdfBytes);

            if (i % 10 === 0 || i === 0 || i === pagesToExtract.length - 1) {
              console.log(`✓ PDF ${i + 1} added to ZIP`);
            }
          } catch (pageError) {
            console.error(`✗ ERROR creating PDF ${i + 1}:`, pageError);
            throw new Error(`Failed on PDF ${i + 1}: ${pageError.message}`);
          }
        }

        console.log('\n=== Generating ZIP file ===');
        const zipStartTime = performance.now();
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const zipEndTime = performance.now();
        console.log(`✓ ZIP generated (${zipBlob.size} bytes) in ${(zipEndTime - zipStartTime).toFixed(2)}ms`);

        downloadFile(zipBlob, `${filename}_extract.zip`, 'application/zip');
      }
    }

    const endTime = performance.now();
    console.log(`\n=== EXTRACT COMPLETED SUCCESSFULLY ===`);
    console.log(`Total time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
  } catch (error) {
    console.error('\n=== EXTRACT FAILED ===');
    console.error('Error details:', error);
    console.error('Stack trace:', error.stack);
    alert(`Error extracting PDF: ${error.message}\n\nCheck console for details.`);
  } finally {
    extractBtn.disabled = false;
    extractBtn.textContent = 'Download Extracted Pages';
  }
}

// Download file
function downloadFile(data, filename, mimeType) {
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}