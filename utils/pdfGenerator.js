const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const HTMLtoPDF = require('pdfkit-html-simple');

exports.buildCompanyPDF = async (res, docData, companyData, pages) => {
  try {
    const pdf = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: docData.title, 
        Author: companyData?.companyName || "System"
      }
    });

    // --- ⭐ FONT REGISTRATION (CRITICAL FOR BOLD/ITALIC) ---
    // If you don't have these files, PDFKit will use standard Helvetica.
    // However, explicit registration ensures the HTML parser can find the "Bold" variant.
    pdf.registerFont('Helvetica-Bold', 'Helvetica-Bold');
    pdf.registerFont('Helvetica-Oblique', 'Helvetica-Oblique');
    
    const cleanFileName = docData.title.replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}.pdf"`);
    pdf.pipe(res);

    const companyName = companyData?.companyName || "Organization Document";
    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });

    let logoPath = null;
    if (companyData?.logo || companyData?.logoUrl) {
      const potentialPath = path.normalize(path.join(process.cwd(), companyData.logo || companyData.logoUrl));
      if (fs.existsSync(potentialPath)) logoPath = potentialPath;
    }

    // --- START PAGE LOOP ---
    for (let index = 0; index < pages.length; index++) {
      const page = pages[index];
      if (index !== 0) pdf.addPage();

      let textStartX = 50;
      if (logoPath) {
        try {
          pdf.image(logoPath, 50, 30, { fit: [35, 35] });
          textStartX = 95;
        } catch (err) { console.error("Logo Error:", err.message); }
      }

      // Header Info
      pdf.font('Helvetica-Bold').fontSize(14).fillColor('#0f172a').text(companyName, textStartX, 35);
      pdf.font('Helvetica').fontSize(10).fillColor('#64748b').text(currentDate, 50, 42, { align: 'right' });

      // Blue Divider
      pdf.moveTo(50, 75).lineTo(545, 75).lineWidth(1.5).strokeColor('#2563eb').stroke();

      // --- ⭐ BODY CONTENT (HTML STYLING) ---
      const htmlContent = (page.content || '<p>&nbsp;</p>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');

      try {
        await HTMLtoPDF.parse(pdf, htmlContent, {
          x: 50,
          y: 110,
          width: 495,
          baseFontSize: 11,
          baseColor: '#334155',
          allowInsecureStyles: true,
          // This ensures <strong> and <em> tags map to the registered fonts above
          fonts: {
            bold: 'Helvetica-Bold',
            italic: 'Helvetica-Oblique',
            regular: 'Helvetica'
          }
        });
      } catch (err) {
        console.error("HTML Parsing Error:", err.message);
        pdf.font('Helvetica').fontSize(11).text(htmlContent.replace(/<[^>]*>?/gm, ''), 50, 110);
      }
    }

    pdf.end();

  } catch (error) {
    console.error("🔴 PDFKit Error:", error);
    if (!res.headersSent) res.status(500).json({ message: "Failed to build PDF." });
  }
};