import PDFDocument from 'pdfkit';

const rs = (n) => 'Rs. ' + Math.round(n).toLocaleString('en-IN');
const INK = '#1B2A33', MUTED = '#5C6B73', GREEN = '#0E6B5C';

export function streamQuotePdf(res, quote, lead) {
  const doc = new PDFDocument({ size: 'A4', margin: 56 });
  doc.pipe(res);
  const main = quote.options.find((o) => o.kw === quote.primaryKw);

  // Page 1: the story. Three numbers before any detail.
  doc.fillColor(MUTED).fontSize(11).text(`Solar quote for ${lead.name}`, { continued: false });
  doc.text(`Ref ${lead.leadId}  |  ${quote.date}`);
  doc.moveDown(3);
  const big = (value, label) => {
    doc.fillColor(INK).fontSize(46).font('Helvetica-Bold').text(value);
    doc.fillColor(MUTED).fontSize(13).font('Helvetica').text(label);
    doc.moveDown(1.6);
  };
  big(`${main.kw} kW`, 'Recommended system size');
  big(rs(main.net), `Your cost after Rs. ${main.subsidy.toLocaleString('en-IN')} subsidy`);
  big(main.paybackYears ? `${main.paybackYears} years` : 'n/a', 'Time to earn the cost back through lower bills');

  // Page 2: detail.
  doc.addPage();
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('System options');
  doc.moveDown();
  const cols = [['Size', 50], ['Price', 80], ['Subsidy', 80], ['You pay', 80], ['Units/yr', 60], ['Saving/yr', 80], ['Payback', 60]];
  let y = doc.y;
  const row = (vals, bold) => {
    let x = 56;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9.5).fillColor(INK);
    vals.forEach((v, i) => { doc.text(String(v), x, y, { width: cols[i][1] - 4 }); x += cols[i][1]; });
    y += 22;
    doc.moveTo(56, y - 6).lineTo(540, y - 6).strokeColor('#D9E0E3').lineWidth(0.5).stroke();
  };
  row(cols.map((c) => c[0]), true);
  quote.options.forEach((o) => row([`${o.kw} kW${o.kw === quote.primaryKw ? ' *' : ''}`, rs(o.gross), rs(o.subsidy), rs(o.net), o.yearlyUnits.toLocaleString('en-IN'), rs(o.yearlySavings), o.paybackYears ? `${o.paybackYears} yr` : 'n/a']));
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('* recommended option', 56, y + 6);
  doc.moveDown(2).fontSize(10).fillColor(INK).font('Helvetica-Bold').text('How we worked this out').font('Helvetica').fillColor(MUTED);
  doc.moveDown(0.4).text(`Generation: ${quote.genPerKw} units per kW per year.`);
  doc.text(`Bill saving: units produced (capped at your own usage of ${Math.round(quote.annualUnitsUsed).toLocaleString('en-IN')} units a year) x Rs. ${quote.tariff} per unit.`);
  doc.text(quote.subsidyRule ? `Subsidy: ${quote.subsidyRule.name} (in force from ${quote.subsidyRule.effectiveFrom}). Final subsidy is decided by the government scheme.` : 'Subsidy: none applied.');
  doc.text(`Price list in force from ${quote.priceListFrom}. Payback ignores tariff changes and panel ageing.`);
  doc.end();
}
