import PDFDocument from 'pdfkit';

export interface SpecPdfData {
  re: string;
  project: string;
  to: string;
  from: string;
  products: string[];
  approvedDrawings: string;
  onHoldItems: string;
  specifications: Record<string, { specification: string; remarks: string }>;
  hardware: Record<string, { suppliedBy: string; finishType: string }>;
  jobsiteAddress: string;
  destinationPort: string;
  shippingWeek: string;
  additionalRemarks: string;
  signatureName: string;
  signatureTitle: string;
}

const SPEC_ITEMS = [
  'Type of wood', 'Split wood species', 'Interior color', 'Exterior color',
  'Type of glazing', 'Solutia (PVB) stamp', 'Breather tubes', 'Spacer bar color',
  'Exterior silicone color', 'Interior silicone', 'Paintable interior silicone',
  'Thermally insulated threshold', 'Swing door wood sub-sill color',
  'Folding door sub-sill color', 'HST Door sub-sill color',
  'Window screen type and color', 'Cut astragal on French casements for fixed screens',
  'Door screen type and mesh', 'Roll screen', 'Roll shade Box',
  'Spiders / Contacts', 'Steel reinforcement approved',
];

const HARDWARE_ITEMS: Array<[string, string]> = [
  ['Swing Doors', 'Screwed-in hinges'], ['Swing Doors', 'Butt hinges'], ['Swing Doors', 'Finial option'],
  ['Casements', 'Screwed-in hinges'], ['Casements', 'Butt hinges'],
  ['Casements', 'Standard concealed hinges'], ['Casements', 'Bodyguard concealed hinges'],
  ['Casements', 'Finial option'], ['Casements', 'Handles'], ['Casements', 'Rainguard Color'],
  ['Casements', 'Casement stays'], ['Casements', 'Crank finish'],
  ['SH / DH', 'Sash stop'], ['SH / DH', 'Sash lock'], ['SH / DH', 'Sash lift'],
  ['SH / DH', 'Chain'], ['SH / DH', 'Pulley'], ['SH / DH', 'Vent lock'],
  ['HST / Folding Doors', 'Track color'], ['HST / Folding Doors', 'Handle finish'],
  ['Rough hardware materials', 'Windows'], ['Rough hardware materials', 'Swing doors'],
  ['Rough hardware materials', 'HST gears'], ['Rough hardware materials', 'HST meeting locks'],
  ['Swing Screens', 'Hinges'], ['Swing Screens', 'Latch set'], ['Swing Screens', 'Flush bolts'],
  ['Sliding Screens', 'Edge pull'], ['Sliding Screens', 'Pull grip'],
];

const NAVY = '#1e3a5f';
const LINE = '#cbd5e1';
const LEFT = 36;
const WIDTH = 540;

export function renderFactoryOrderSpecPDF(spec: SpecPdfData, projectName: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margins: { top: 36, right: 36, bottom: 36, left: 36 } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    let y = 36;

    const ensureSpace = (height: number) => {
      if (y + height > doc.page.height - 36) {
        doc.addPage();
        y = 36;
      }
    };
    const textHeight = (value: string, width: number, fontSize = 8) => {
      doc.font('Helvetica').fontSize(fontSize);
      return doc.heightOfString(value || ' ', { width: width - 10 });
    };
    const band = (label: string) => {
      ensureSpace(25);
      doc.rect(LEFT, y, WIDTH, 22).fill(NAVY);
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text(label, LEFT + 8, y + 6);
      y += 22;
    };
    const row = (cells: string[], widths: number[], header = false) => {
      const height = Math.max(20, ...cells.map((cell, index) => textHeight(cell, widths[index], header ? 8 : 8) + 8));
      ensureSpace(height);
      let x = LEFT;
      cells.forEach((cell, index) => {
        const width = widths[index];
        doc.rect(x, y, width, height).lineWidth(0.4).strokeColor(LINE).fillAndStroke(header ? '#e9eef5' : '#ffffff', LINE);
        doc.font(header ? 'Helvetica-Bold' : 'Helvetica').fontSize(8).fillColor('#26374b')
          .text(cell, x + 5, y + 4, { width: width - 10, lineBreak: true });
        x += width;
      });
      y += height;
    };
    const note = (label: string, value: string) => {
      ensureSpace(25 + textHeight(value, WIDTH));
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY).text(label, LEFT, y + 8);
      y += 21;
      doc.font('Helvetica').fontSize(9).fillColor('#26374b').text(value || ' ', LEFT + 5, y, { width: WIDTH - 10 });
      y = doc.y + 12;
    };

    doc.font('Helvetica-Bold').fontSize(15).fillColor(NAVY).text('ORDER SPECIFICATION', LEFT, y);
    y = doc.y + 12;
    band('ORDER INFORMATION');
    row(['RE:', spec.re, 'PROJECT:', projectName], [55, 215, 70, 200]);
    row(['TO:', spec.to, 'FROM:', spec.from], [55, 215, 70, 200]);
    row(['PRODUCT:', spec.products.join('  /  ')], [90, 450]);
    note('APPROVED SHOP DRAWINGS FOR FACTORY ORDER, DATE & REVISION NUMBER:', spec.approvedDrawings);
    note('ON HOLD ITEMS / PRE-PRODUCTION RELEASE:', spec.onHoldItems);

    band('SPECIFICATIONS');
    row(['#', 'ITEM', 'SPECIFICATION', 'REMARKS'], [25, 185, 165, 165], true);
    SPEC_ITEMS.forEach((item, index) => {
      const value = spec.specifications[String(index + 1)];
      row([String(index + 1), item, value?.specification ?? '', value?.remarks ?? ''], [25, 185, 165, 165]);
    });

    doc.addPage();
    y = 36;
    band('HARDWARE SPECIFICATIONS');
    row(['HARDWARE', 'ITEM', 'SUPPLIED BY', 'FINISH / TYPE'], [110, 170, 125, 135], true);
    HARDWARE_ITEMS.forEach(([group, item], index) => {
      const value = spec.hardware[`${group}:${item}`];
      row([index === 0 || HARDWARE_ITEMS[index - 1][0] !== group ? group : '', item, value?.suppliedBy ?? '', value?.finishType ?? ''], [110, 170, 125, 135]);
    });

    band('SHIPPING');
    row(['Jobsite Address:', spec.jobsiteAddress], [130, 410]);
    row(['Destination Port:', spec.destinationPort], [130, 410]);
    row(['Shipping Week:', spec.shippingWeek], [130, 410]);
    band('ADDITIONAL REMARKS');
    note('', spec.additionalRemarks);
    ensureSpace(90);
    doc.font('Helvetica').fontSize(9).fillColor('#26374b')
      .text('Please confirm this order with me at your earliest convenience. Thank you!', LEFT, y, { width: WIDTH });
    y = doc.y + 12;
    doc.text('Sincerely,', LEFT, y);
    y = doc.y + 16;
    doc.font('Helvetica-Bold').text(spec.signatureName, LEFT, y);
    y = doc.y + 3;
    doc.font('Helvetica-Oblique').text(spec.signatureTitle, LEFT, y);
    doc.end();
  });
}