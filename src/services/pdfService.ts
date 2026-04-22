import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export const generateJobSummaryPDF = async (elementId: string, filename: string = 'job-report.pdf') => {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element with id ${elementId} not found`);
    return;
  }

  try {
    // We want high quality, so we increase the scale
    const canvas = await html2canvas(element, {
      scale: 2, // Double resolution for crisp text
      useCORS: true, // Allow images from other domains if CORS headers are set
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight
    });

    const imgData = canvas.toDataURL('image/png');
    
    // A4 dimensions in mm: 210 x 297
    // Calculate aspect ratio to fit the page
    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
    
    // If content is longer than one A4 page, we might need to handle multi-page
    // but for summary reports typically one page is enough unless many photos.
    // If pdfHeight > page height, we can adjust or handle multiple slices.
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(filename);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};
