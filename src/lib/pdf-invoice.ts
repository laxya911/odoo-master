import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export function generateInvoice(orderData: any) {
  const doc = new jsPDF();
  
  const { order } = orderData;
  if (!order) return;

  let invoiceNum = order.pos_reference || order.name;
  if (order.account_move && Array.isArray(order.account_move) && order.account_move[1]) {
    invoiceNum = order.account_move[1];
  }
  const date = new Date(order.date_order);
  const formattedDate = format(date, 'MM/dd/yyyy');

  // Colors
  const primaryColor: [number, number, number] = [30, 41, 59]; // slate-800
  const secondaryColor: [number, number, number] = [100, 116, 139]; // slate-500
  const accentColor: [number, number, number] = [212, 175, 55]; // gold

  // --- Header ---
  doc.setFontSize(24);
  doc.setTextColor(...primaryColor);
  doc.text('INVOICE', 14, 25);

  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text(`Invoice Number: ${invoiceNum}`, 14, 32);
  doc.text(`Date: ${formattedDate}`, 14, 37);
  doc.text(`Status: ${order.state.toUpperCase()}`, 14, 42);

  // --- Company Details (Right side) ---
  doc.setFontSize(14);
  doc.setTextColor(...primaryColor);
  doc.text('RAM & CO.', 140, 25);
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text('123 Culinary Ave.', 140, 32);
  doc.text('Tokyo, Japan 100-0001', 140, 37);
  doc.text('Phone: +81 3-1234-5678', 140, 42);
  doc.text('Email: info@ramandco.com', 140, 47);

  // --- Customer Details ---
  const partner = order.partner_detail;
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.text('Billed To:', 14, 55);
  
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  let startY = 62;
  if (partner) {
    doc.text(partner.name || 'Walk-in Customer', 14, startY);
    if (partner.email) {
      startY += 5;
      doc.text(partner.email, 14, startY);
    }
    if (partner.phone) {
      startY += 5;
      doc.text(partner.phone, 14, startY);
    }
    let address = [partner.street, partner.city, partner.zip].filter(Boolean).join(', ');
    if (address) {
      startY += 5;
      doc.text(address, 14, startY);
    }
  } else {
    doc.text('Walk-in Customer', 14, startY);
  }

  // --- Table ---
  const tableData = (order.line_items || []).map((line: any) => {
    let name = line.full_product_name || line.product_id[1];
    if (line.customer_note) {
      name += `\nNote: ${line.customer_note}`;
    } else if (line.note && !line.note.startsWith('[')) {
      name += `\nNote: ${line.note}`;
    }
    return [
      name,
      line.qty,
      `¥${line.price_unit.toLocaleString()}`,
      `¥${line.price_subtotal_incl.toLocaleString()}`
    ];
  });

  autoTable(doc, {
    startY: startY + 12,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    styles: {
      fontSize: 10,
      cellPadding: 6,
    },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: 'center' },
      2: { halign: 'right' },
      3: { halign: 'right' },
    },
    margin: { top: 10 },
  });

  // --- Totals ---
  // @ts-ignore
  const finalY = doc.lastAutoTable.finalY + 10;
  
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  doc.text('Subtotal:', 140, finalY);
  doc.text('Tax:', 140, finalY + 6);
  
  doc.setFontSize(12);
  doc.setTextColor(...primaryColor);
  doc.setFont('helvetica', 'bold');
  doc.text('Total:', 140, finalY + 14);

  // Align values to right
  const subtotalStr = `¥${(order.amount_total - order.amount_tax).toLocaleString()}`;
  const taxStr = `¥${order.amount_tax.toLocaleString()}`;
  const totalStr = `¥${order.amount_total.toLocaleString()}`;

  doc.setFont('helvetica', 'normal');
  doc.text(subtotalStr, 196, finalY, { align: 'right' });
  doc.text(taxStr, 196, finalY + 6, { align: 'right' });
  
  doc.setFont('helvetica', 'bold');
  doc.text(totalStr, 196, finalY + 14, { align: 'right' });

  // --- Footer ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(...secondaryColor);
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.text('Thank you for your business!', 105, footerY, { align: 'center' });

  // Save the PDF
  doc.save(`Invoice_${invoiceNum.replace(/\W+/g, '_')}.pdf`);
}
