import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function generateInvoice(orderData: any) {
  const doc = new jsPDF();
  
  const { order } = orderData;
  if (!order) return;

  let invoiceNum = order.pos_reference || order.name || 'DRAFT';
  if (order.account_move && Array.isArray(order.account_move) && order.account_move[1]) {
    invoiceNum = order.account_move[1];
  }
  const date = order.date_order ? new Date(order.date_order) : new Date();
  const formattedDate = format(date, 'MMMM dd, yyyy');

  // Colors - Premium Palette
  const primaryColor: [number, number, number] = [10, 10, 10]; // Near black
  const secondaryColor: [number, number, number] = [80, 80, 80]; // Medium gray
  const accentColor: [number, number, number] = [184, 148, 88]; // Metallic Gold
  const lightGray: [number, number, number] = [245, 245, 245];

  // --- Background Accents ---
  doc.setFillColor(...lightGray);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(1.5);
  doc.line(14, 40, 196, 40);

  // --- Header ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...primaryColor);
  doc.text('RAM & CO.', 14, 25);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text('AUTHENTIC HIMALAYAN CUISINE', 14, 32);

  // --- Invoice Info (Right Header) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...accentColor);
  doc.text('INVOICE', 196, 25, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text(`${invoiceNum}`, 196, 32, { align: 'right' });

  // --- Address Details ---
  let currentY = 55;
  
  // From (Company)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('FROM:', 14, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text('RAM & CO. Restaurants', 14, currentY + 6);
  doc.text('3-3-16 Minami-cho,山口 Bldg 1F', 14, currentY + 11);
  doc.text('Mito City, Ibaraki, Japan', 14, currentY + 16);
  doc.text('Phone: +81 29-231-1510', 14, currentY + 21);

  // To (Customer)
  const partner = order.partner_detail || order.partner_id;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('BILLED TO:', 120, currentY);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  let customerName = 'Walk-in Customer';
  let email = '';
  let phone = '';
  let fullAddress = '';

  if (partner) {
    if (typeof partner === 'object') {
        customerName = partner.name || customerName;
        email = partner.email || '';
        phone = partner.phone || '';
        fullAddress = [partner.street, partner.city, partner.zip].filter(Boolean).join(', ');
    } else if (Array.isArray(partner) && partner[1]) {
        customerName = partner[1];
    }
  }

  doc.text(customerName, 120, currentY + 6);
  let customerY = currentY + 11;
  if (email) { doc.text(email, 120, customerY); customerY += 5; }
  if (phone) { doc.text(phone, 120, customerY); customerY += 5; }
  if (fullAddress) { 
    const splitAddress = doc.splitTextToSize(fullAddress, 70);
    doc.text(splitAddress, 120, customerY);
  }

  // --- Dates ---
  currentY = 100;
  doc.setFillColor(...lightGray);
  doc.rect(14, currentY, 182, 12, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...primaryColor);
  doc.text('DATE ISSUED', 20, currentY + 8);
  doc.text('ORDER REFERENCE', 80, currentY + 8);
  doc.text('PAYMENT STATUS', 140, currentY + 8);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...secondaryColor);
  doc.text(formattedDate, 20, currentY + 18);
  doc.text(order.pos_reference || order.name || '-', 80, currentY + 18);
  doc.text((order.state || 'DRAFT').toUpperCase(), 140, currentY + 18);

  // --- Items Table ---
  const tableData = (order.line_items || []).map((line: any) => {
    let name = line.full_product_name || (Array.isArray(line.product_id) ? line.product_id[1] : line.product_uuid || 'Unknown Product');
    if (line.customer_note) {
      name += `\nNote: ${line.customer_note}`;
    } else if (line.note && !line.note.startsWith('[')) {
      name += `\nNote: ${line.note}`;
    }
    return [
      name,
      line.qty,
      `¥${(line.price_unit || 0).toLocaleString()}`,
      `¥${(line.price_subtotal_incl || 0).toLocaleString()}`
    ];
  });

  autoTable(doc, {
    startY: 130,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left'
    },
    styles: {
      fontSize: 9,
      cellPadding: 6,
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // --- Totals ---
  // @ts-ignore
  let finalY = doc.lastAutoTable.finalY + 15;
  
  const amountTotal = order.amount_total || 0;
  const amountTax = order.amount_tax || 0;
  const amountSubtotal = amountTotal - amountTax;

  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.setFont('helvetica', 'normal');
  doc.text('Subtotal:', 140, finalY);
  doc.text(`¥${amountSubtotal.toLocaleString()}`, 196, finalY, { align: 'right' });
  
  doc.text('Tax:', 140, finalY + 8);
  doc.text(`¥${amountTax.toLocaleString()}`, 196, finalY + 8, { align: 'right' });

  doc.setDrawColor(...lightGray);
  doc.line(135, finalY + 12, 196, finalY + 12);
  
  doc.setFontSize(14);
  doc.setTextColor(...accentColor);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL:', 140, finalY + 20);
  doc.text(`¥${amountTotal.toLocaleString()}`, 196, finalY + 20, { align: 'right' });

  // --- Footer ---
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...secondaryColor);
  const footerY = doc.internal.pageSize.getHeight() - 25;
  
  doc.setDrawColor(...accentColor);
  doc.setLineWidth(0.5);
  doc.line(14, footerY - 5, 196, footerY - 5);
  
  doc.text('Thank you for choosing RAM & CO. We look forward to serving you again!', 105, footerY + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('This is a computer-generated invoice and does not require a signature.', 105, footerY + 12, { align: 'center' });

  // Save the PDF
  const safeRef = (invoiceNum || 'Invoice').replace(/\W+/g, '_');
  doc.save(`${safeRef}.pdf`);
}
