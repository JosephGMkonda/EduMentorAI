import pikepdf

input_path = "app/books/form1/mathematics/syllabus.pdf"
output_path = "app/books/form1/mathematics/syllabus_fixed.pdf"

pdf = pikepdf.open(input_path)
pdf.save(output_path)
pdf.close()

print("Repair complete:", output_path)