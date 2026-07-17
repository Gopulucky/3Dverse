import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

def generate_invoice_pdf(order_id: int, customer_name: str, items: list, subtotal: float, shipping: float, total: float) -> str:
    # Set up directory
    invoices_dir = os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "invoices")
    os.makedirs(invoices_dir, exist_ok=True)
    
    file_name = f"invoice_{order_id}_{int(datetime.utcnow().timestamp())}.pdf"
    file_path = os.path.join(invoices_dir, file_name)
    
    doc = SimpleDocTemplate(file_path, pagesize=letter)
    styles = getSampleStyleSheet()
    Story = []
    
    # Title
    title = Paragraph("3DVerse Invoice", styles['Heading1'])
    Story.append(title)
    Story.append(Spacer(1, 12))
    
    # Order Info
    Story.append(Paragraph(f"Order ID: {order_id}", styles['Normal']))
    Story.append(Paragraph(f"Date: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
    Story.append(Paragraph(f"Customer: {customer_name}", styles['Normal']))
    Story.append(Spacer(1, 12))
    
    # Items Table
    data = [["Item", "Quantity", "Price", "Total"]]
    for item in items:
        # Expecting item to be a dict: {'title': str, 'quantity': int, 'price': float}
        row_total = item['quantity'] * item['price']
        data.append([item['title'], str(item['quantity']), f"${item['price']:.2f}", f"${row_total:.2f}"])
        
    data.append(["", "", "Subtotal:", f"${subtotal:.2f}"])
    data.append(["", "", "Shipping:", f"${shipping:.2f}"])
    data.append(["", "", "Total:", f"${total:.2f}"])
    
    table = Table(data, colWidths=[250, 70, 80, 80])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    
    Story.append(table)
    
    doc.build(Story)
    
    return f"/uploads/invoices/{file_name}"
