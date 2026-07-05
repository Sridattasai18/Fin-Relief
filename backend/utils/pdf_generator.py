import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

def generate_letter_pdf(
    borrower_name: str,
    borrower_email: str,
    lender_name: str,
    letter_text: str
) -> BytesIO:
    """
    Generates a professional OTS letter PDF using ReportLab.
    Returns a BytesIO stream containing the PDF binary.
    """
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()
    
    # Custom styles
    brand_style = ParagraphStyle(
        'BrandStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        textColor=colors.HexColor('#1B1A17'),
        spaceAfter=3
    )
    
    brand_sub = ParagraphStyle(
        'BrandSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        textColor=colors.HexColor('#7A776E'),
        spaceAfter=15
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#1B1A17')
    )

    body_style = ParagraphStyle(
        'LetterBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=16,
        textColor=colors.HexColor('#1B1A17'),
        spaceAfter=12
    )

    story = []

    # 1. Letterhead / Branding
    story.append(Paragraph("FinRelief AI", brand_style))
    story.append(Paragraph("AI-Powered Debt Settlement & Negotiation Platform", brand_sub))
    story.append(Spacer(1, 10))

    # 2. Date and Sender details (Right aligned, or simple meta box)
    current_date = datetime.date.today().strftime("%B %d, %Y")
    
    sender_info = f"<b>Date:</b> {current_date}<br/><b>Borrower:</b> {borrower_name}<br/><b>Email:</b> {borrower_email}"
    story.append(Paragraph(sender_info, header_style))
    story.append(Spacer(1, 20))

    # 3. Main letter text
    # Convert double newlines into Paragraphs, and single newlines into <br/>
    paragraphs_raw = letter_text.split('\n\n')
    for p_raw in paragraphs_raw:
        if p_raw.strip():
            # Replace single newlines within a block with br
            p_html = p_raw.replace('\n', '<br/>')
            story.append(Paragraph(p_html, body_style))

    # 4. Signature block helper
    story.append(Spacer(1, 20))
    story.append(Paragraph("___________________________", body_style))
    story.append(Paragraph(f"<b>{borrower_name}</b><br/>(Authorized Account Holder)", body_style))

    doc.build(story)
    buffer.seek(0)
    return buffer
