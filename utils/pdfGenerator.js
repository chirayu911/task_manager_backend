const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

exports.buildCompanyPDF = (res, docData, companyData, pages) => {
  try {
    const pdf = new PDFDocument({ 
      margin: 50,
      size: 'A4',
      info: {
        Title: docData.title, 
        Author: companyData?.companyName || "System"
      }
    });

    const cleanFileName = docData.title.replace(/[^a-zA-Z0-9-_\s]/g, '').trim().replace(/\s+/g, '_');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}.pdf"`);
    pdf.pipe(res);

    const companyName = companyData?.companyName || "Organization Document";
    const companyEmail = companyData?.companyEmail || "";
    const fullAddress = companyData?.fullAddress || "";
    const companyPhone = companyData?.phoneNumber || ""; 
    const totalPages = pages.length;

    const currentDate = new Date().toLocaleDateString('en-US', { 
      year: 'numeric', month: 'long', day: 'numeric' 
    });

    // ==========================================
    // ⭐ BULLETPROOF LOGO PATHING
    // ==========================================
    let logoPath = null;
    const logoField = companyData?.logo || companyData?.logoUrl; 
    
    console.log("-----------------------------------------");
    console.log("PDF GEN: Looking for Logo in DB ->", logoField);

    if (logoField) {
      // process.cwd() gets the exact folder where server.js is running
      // path.normalize fixes any weird Windows backslashes (\ vs /)
      const potentialPath = path.normalize(path.join(process.cwd(), logoField));
      
      console.log("PDF GEN: Checking physical hard drive path ->", potentialPath);

      if (fs.existsSync(potentialPath)) {
        console.log("PDF GEN: ✅ Logo found on hard drive!");
        logoPath = potentialPath;
      } else {
        console.log("PDF GEN: ❌ Logo NOT FOUND at that path.");
      }
    } else {
       console.log("PDF GEN: ❌ No logoUrl found in company database object.");
    }
    console.log("-----------------------------------------");

    pages.forEach((page, index) => {
      const isFirstPage = index === 0;

      if (!isFirstPage) pdf.addPage();

      let textStartX = 50; 

      // ⭐ DRAW LOGO
      if (logoPath) {
        try {
          // Draw the logo at X:50, Y:30
          pdf.image(logoPath, 50, 30, { fit: [35, 35] });
          textStartX = 95; // Shift the Company Name to the right
        } catch (err) {
          console.error("PDF GEN: 🔴 Failed to render logo image:", err.message);
        }
      }

      // Company Name
      pdf.font('Helvetica-Bold')
         .fontSize(14)
         .fillColor('#0f172a') 
         .text(companyName, textStartX, 35);
         
      // Date
      pdf.font('Helvetica')
         .fontSize(10)
         .fillColor('#64748b') 
         .text(currentDate, 50, 42, { align: 'right' });
         
      // Email
      if (companyEmail) {
        pdf.text(companyEmail, textStartX, 52, { align: 'left' });
      }

      // Header Line
      pdf.moveTo(50, 75)
         .lineTo(545, 75)
         .lineWidth(1.5)
         .strokeColor('#2563eb') 
         .stroke();

      pdf.lineWidth(1);

      // Title
      let startY = 110; 

      if (isFirstPage) {
        pdf.font('Helvetica-Bold')
           .fontSize(24)
           .fillColor('#0f172a')
           .text(docData.title, 50, startY, { align: 'center', width: 495 });
           
        const titleHeight = pdf.heightOfString(docData.title, { width: 495, align: 'center' });
        startY += titleHeight + 25; 
      } else {
        startY = 100; 
      }

      // Body Content
      let rawText = page.content ? String(page.content) : ' ';
      
      let cleanContent = rawText
        .replace(/<\/p>/gi, '\n\n')        
        .replace(/<br\s*[\/]?>/gi, '\n')   
        .replace(/<li>/gi, '• ')           
        .replace(/<\/li>/gi, '\n')         
        .replace(/&nbsp;/g, ' ')           
        .replace(/&amp;/g, '&')            
        .replace(/<[^>]*>?/gm, '')         
        .trim();
      
      pdf.font('Helvetica')
         .fontSize(11) 
         .fillColor('#334155') 
         .text(cleanContent, 50, startY, {
           align: 'justify',
           lineGap: 5,
           width: 495
         });

      // Footer
      const footerY = pdf.page.height - 50; 
      
      pdf.moveTo(50, footerY)
         .lineTo(545, footerY)
         .lineWidth(0.5)
         .strokeColor('#e2e8f0') 
         .stroke();
      
      pdf.font('Helvetica')
         .fontSize(8)
         .fillColor('#94a3b8');
      
      if (companyPhone) {
        pdf.text(`Tel: ${companyPhone}`, 50, footerY + 10, { align: 'left', width: 150 });
      }
      
      pdf.text(`Page ${index + 1} of ${totalPages}`, 200, footerY + 10, { align: 'center', width: 195 });

      if (fullAddress) {
        pdf.text(fullAddress, 395, footerY + 10, { align: 'right', width: 150 });
      }
    });

    pdf.end();

  } catch (error) {
    console.error("🔴 PDFKit Render Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to build PDF structure." });
    }
  }
};