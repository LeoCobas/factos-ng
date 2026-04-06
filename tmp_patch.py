import re
with open('src/app/features/listado/listado.component.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove disabled checks in HTML
content = re.sub(r'\[disabled\]=\"!notaCreditoEmitida\(\)\?\.pdf_url\"\>', '>', content)

# Remove early returns in TS
patterns = [
    r'\s*if \(!factura\.pdf_url\) \{[\s\n]*console\.error[^}]+\}[\s\n]*return;[\s\n]*\}',
    r'\s*if \(!notaCredito\?\.pdf_url\) \{[\s\n]*console\.error[^}]+\}[\s\n]*return;[\s\n]*\}',
    r'\s*if \(!notaCreditoEmitida\(\)\?\.pdf_url\) \{[\s\n]*console\.error[^}]+\}[\s\n]*return;[\s\n]*\}'
]
for p in patterns:
    content = re.sub(p, '', content)

# Fix verPDF / url extraction
content = content.replace('url: factura.pdf_url,', 'url: \'\',') # Placeholder
content = content.replace('url: notaCredito.pdf_url,', 'url: \'\',')

content = content.replace('const pdfBlob = await this.pdfService[\'downloadPdfBlob\'](factura.pdf_url);', 'const pdfBlob = await this.pdfService[\'getPdfBlob\'](factura);')

content = content.replace('window.open(factura.pdf_url, \'_blank\');', '')
content = content.replace('window.open(notaCredito.pdf_url, \'_blank\');', '')

content = content.replace('pdf_url: notaCredito.pdf_url,', '')
content = content.replace('pdf_url: factura.pdf_url,', '')
content = content.replace('pdf_url: c.pdf_url || undefined,', '')
content = content.replace('pdf_url: resultado.data?.pdf_url,', '')

with open('src/app/features/listado/listado.component.ts', 'w', encoding='utf-8') as f:
    f.write(content)
