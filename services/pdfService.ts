import { jsPDF } from 'jspdf';
import { SubscriptionPlan, canViewFullFinancials, canViewRegionalIntelligence } from '../src/utils/planUtils';
import { ViabilityReport } from '../types';

export interface PDFExportOptions {
  isWhiteLabelMode: boolean;
  advisoryFirmName: string;
  clientName: string;
  accentColor: 'Classic Blue' | 'Charcoal Slate' | 'Emerald Forest' | 'Executive Navy';
  removeWatermark: boolean;
}

// Map color choices to RGB and HEX formats
const COLOR_PALETTES = {
  'Classic Blue': { primary: [30, 64, 175] as [number, number, number], light: [239, 246, 255] as [number, number, number] },
  'Charcoal Slate': { primary: [55, 65, 81] as [number, number, number], light: [243, 244, 246] as [number, number, number] },
  'Emerald Forest': { primary: [6, 95, 70] as [number, number, number], light: [236, 253, 245] as [number, number, number] },
  'Executive Navy': { primary: [15, 23, 42] as [number, number, number], light: [241, 245, 249] as [number, number, number] }
};

export class PDFService {
  /**
   * Generates and downloads a highly polished advisory PDF dossier.
   */
  public static async generateReportPDF(
    report: ViabilityReport,
    plan: SubscriptionPlan,
    options: PDFExportOptions,
    regionalData?: any
  ): Promise<void> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const palette = COLOR_PALETTES[options.accentColor] || COLOR_PALETTES['Classic Blue'];
    const pColor = palette.primary;
    const lColor = palette.light;

    let pageNumber = 1;

    // Helper: Draw Header and Footer watermarks
    const addPageDecoration = (pageNum: number) => {
      // Top header line
      doc.setDrawColor(220, 225, 230);
      doc.setLineWidth(0.3);
      doc.line(20, 15, 190, 15);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(140, 145, 150);

      // Header Text
      if (options.isWhiteLabelMode && plan === 'Enterprise') {
        doc.text(options.advisoryFirmName.toUpperCase() + " | FEASIBILITY PORTFOLIO", 20, 11);
      } else {
        doc.text("BIZSCOPE | AI-POWERED BUSINESS VIABILITY STUDY", 20, 11);
      }

      // Footer
      doc.line(20, 280, 190, 280);
      doc.text(`Page ${pageNum}`, 178, 285);

      if (options.isWhiteLabelMode && plan === 'Enterprise' && options.removeWatermark) {
        doc.text("Confidential Custom Advisory Ledger. Restricted.", 20, 285);
      } else {
        doc.text("Generated via BizScope Premium. Proprietary intelligence database.", 20, 285);
      }
    };

    // Helper: Safely write wrapped paragraphs and return the updated Y coordinate
    const writeWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 5.5): number => {
      if (!text) return y;
      const lines: string[] = doc.splitTextToSize(text, maxWidth);
      for (const line of lines) {
        if (y > 268) {
          doc.addPage();
          pageNumber++;
          addPageDecoration(pageNumber);
          // Reset font configuration inside newly spawned page
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(10);
          doc.setTextColor(60, 65, 70);
        }
        doc.text(line, x, y);
        y += lineHeight;
      }
      return y;
    };

    // Helper: Check space and push page if needed
    const ensureRemainingY = (currentY: number, spaceRequired: number): number => {
      if (currentY + spaceRequired > 268) {
        doc.addPage();
        pageNumber++;
        addPageDecoration(pageNumber);
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(60, 65, 70);
        return 22; // reset Y to top margin
      }
      return currentY;
    };

    // ==========================================
    // PAGE 1: COVER ADVISORY SHEET
    // ==========================================
    // Accent block background
    doc.setFillColor(pColor[0], pColor[1], pColor[2]);
    doc.rect(20, 25, 170, 12, 'F');

    // Title Block branding
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.setTextColor(20, 25, 30);
    doc.text("VENTURE FEASIBILITY", 20, 55);
    doc.text("DOSSIER", 20, 66);

    // Dynamic Line Accent
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(1.5);
    doc.line(20, 74, 90, 74);

    // Study Specifics Metadata table
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 110, 120);
    doc.text("BUSINESS MODEL TARGET :", 20, 88);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 35, 40);
    doc.text(report.businessType.toUpperCase(), 75, 88);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 110, 120);
    doc.text("GEOGRAPHIC SECTOR LOCATION :", 20, 96);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 35, 40);
    doc.text(report.location.toUpperCase(), 86, 96);

    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(100, 110, 120);
    doc.text("ADVISORY SYSTEM GRADE :", 20, 104);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(30, 35, 40);
    doc.text(`${plan.toUpperCase()} SUITE`, 78, 104);

    // Score Callout Section
    doc.setFillColor(lColor[0], lColor[1], lColor[2]);
    doc.rect(20, 116, 170, 50, 'F');
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.5);
    doc.rect(20, 116, 170, 50, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("CORE MARKET FEASIBILITY RATING", 30, 128);

    doc.setFontSize(36);
    doc.setTextColor(20, 25, 30);
    doc.text(`${report.viabilityScore}%`, 30, 146);

    doc.setFontSize(11);
    doc.setTextColor(60, 65, 70);
    doc.text(`Directive Verdict: ${report.recommendation?.decision || "Caution Advised"}`, 30, 156);

    // Score breakdown block side elements
    if (report.scoreBreakdown) {
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 90, 100);
      doc.text(`Market Demand Score: ${report.scoreBreakdown.marketDemand}/100`, 95, 128);
      doc.text(`Financial Feasibility Index: ${report.scoreBreakdown.financialFeasibility}/100`, 95, 134);
      doc.text(`Competition Intensity Margin: ${report.scoreBreakdown.competitionIntensity}/100`, 95, 140);
      doc.text(`Risk Assessment Mitigation Score: ${report.scoreBreakdown.riskLevel}/100`, 95, 146);
    }

    // Corporate meta info block bottom
    doc.setDrawColor(210, 215, 220);
    doc.setLineWidth(0.3);
    doc.line(20, 185, 190, 185);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 115, 120);

    const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.text(`Dossier Compiled On: ${dateStr}`, 20, 195);
    
    if (options.isWhiteLabelMode && plan === 'Enterprise') {
      doc.text(`Advisory Syndicate: ${options.advisoryFirmName}`, 20, 201);
      doc.text(`Prepared Explicitly For: ${options.clientName}`, 20, 207);
    } else {
      doc.text("Advisory Syndicate: BizScope Corporate Analytics Platform", 20, 201);
      doc.text("Prepared Explicitly For: Premium Business Member Account", 20, 207);
    }

    // Standard cover disclaimer text
    doc.setFontSize(7.5);
    doc.text("DISCLAIMER: This assessment parameters report uses real economic models, regional data, and statistical trends.", 20, 260);
    doc.text("Final viability outcomes require personal financial underwriting, professional legal consultation, and general due diligence.", 20, 264);

    // Add first page watermark footer
    addPageDecoration(1);

    // ==========================================
    // PAGE 2: EXECUTIVE SUMMARY & DEMOGRAPHICS
    // ==========================================
    doc.addPage();
    pageNumber++;
    addPageDecoration(pageNumber);

    let currentY = 25;

    // Header title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("1. EXECUTIVE ADVISORY SUMMARY", 20, currentY);
    
    currentY += 6;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.6);
    doc.line(20, currentY, 190, currentY);
    
    currentY += 8;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(60, 65, 70);
    
    // Write summary content
    currentY = writeWrappedText(report.executiveSummary, 20, currentY, 170);

    currentY += 8;
    currentY = ensureRemainingY(currentY, 60);

    // Section 2: Demographic Insights
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("2. DEMOGRAPHIC BENCHMARKS & SNAPSHOT", 20, currentY);
    
    currentY += 4;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.4);
    doc.line(20, currentY, 190, currentY);

    if (report.demographicInsights) {
      currentY += 8;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 65, 70);
      currentY = writeWrappedText(report.demographicInsights.summary, 20, currentY, 170);

      // Demographic Indicators Grid Table
      if (report.demographicInsights.demographics && report.demographicInsights.demographics.length > 0) {
        currentY += 6;
        currentY = ensureRemainingY(currentY, 40);

        // Header Table
        doc.setFillColor(lColor[0], lColor[1], lColor[2]);
        doc.rect(20, currentY, 170, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(pColor[0], pColor[1], pColor[2]);
        doc.text("METRIC CLASSIFICATION", 24, currentY + 5);
        doc.text("MEASURED BENCHMARK VALUE", 95, currentY + 5);
        
        currentY += 7;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(60, 65, 70);

        for (const item of report.demographicInsights.demographics) {
          currentY = ensureRemainingY(currentY, 14);

          // Alternating row separator border line
          doc.setDrawColor(235, 240, 245);
          doc.line(20, currentY + 7, 190, currentY + 7);

          doc.setFont('Helvetica', 'bold');
          doc.text(item.metric, 24, currentY + 4);
          doc.setFont('Helvetica', 'normal');
          doc.text(item.value, 95, currentY + 4);

          currentY += 8;
          currentY = ensureRemainingY(currentY, 6);
          // Small italic insight below metric
          doc.setFont('Helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(110, 115, 120);
          currentY = writeWrappedText(`💡 Insight: ${item.insight}`, 24, currentY, 160, 4);
          currentY += 2;
          
          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 65, 70);
        }
      }
    }

    // ==========================================
    // PAGE 3: FINANCIAL MODELS & FORECASTING
    // ==========================================
    doc.addPage();
    pageNumber++;
    addPageDecoration(pageNumber);

    currentY = 25;

    // Header title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("3. ADVISORY PRO-FORMA FINANCIAL MODELS", 20, currentY);
    
    currentY += 6;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.6);
    doc.line(20, currentY, 190, currentY);

    // Plan evaluation check
    const isFinancialsUnlocked = canViewFullFinancials(plan);
    if (!isFinancialsUnlocked) {
      currentY += 12;
      doc.setFillColor(254, 243, 199);
      doc.rect(20, currentY, 170, 35, 'F');
      doc.setDrawColor(245, 158, 11);
      doc.setLineWidth(0.5);
      doc.rect(20, currentY, 170, 35, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(146, 64, 14);
      doc.text("PRO PLAN REQUIRED — FINANCIALS EXCLUDED FROM EXPORT", 26, currentY + 8);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(180, 83, 9);
      currentY += 14;
      currentY = writeWrappedText("Full financial projections including revenue forecasts, ROI margins, and break-even analysis are available on the Pro plan and above. Upgrade your subscription to include these sections in future exports.", 26, currentY, 158, 4.5);
    } else {
      currentY += 8;
      // Pro-Forma Overview Statement
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 65, 70);
      currentY = writeWrappedText(report.financialProjections.summary, 20, currentY, 170);

      currentY += 8;
      currentY = ensureRemainingY(currentY, 70);

      // Key Metrics Box
      doc.setFillColor(lColor[0], lColor[1], lColor[2]);
      doc.rect(20, currentY, 170, 32, 'F');
      doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
      doc.setLineWidth(0.3);
      doc.rect(20, currentY, 170, 32, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text("ESTIMATED STARTUP INVESTMENT CAPEX RANGE", 25, currentY + 8);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(20, 25, 30);
      doc.text(report.financialProjections.startupCostRange, 25, currentY + 16);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 85, 90);
      writeWrappedText(report.financialProjections.startupCostBreakdown, 25, currentY + 22, 160, 4);

      // Financial performance columns table
      currentY += 38;
      currentY = ensureRemainingY(currentY, 65);

      doc.setFillColor(lColor[0], lColor[1], lColor[2]);
      doc.rect(20, currentY, 170, 7, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text("FINANCIAL CRITERIA", 24, currentY + 5);
      doc.text("FORECASTED OUTCOME METRIC / STATUS", 95, currentY + 5);

      currentY += 7;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 65, 70);

      const finItems = [
        { label: "Year 1 Projected Gross Revenue", val: report.financialProjections.revenueYear1 },
        { label: "Year 3 Projected Gross Revenue", val: report.financialProjections.revenueYear3 },
        { label: "Target Operational Profit Margin", val: report.financialProjections.profitMargin },
        { label: "Estimated Business Break-Even Period", val: report.financialProjections.breakEvenTime },
        { label: "Key ROI Return Interval", val: report.financialProjections.roiTime },
        { label: "Venture Scalability Multiplier", val: report.financialProjections.scalability }
      ];

      for (const item of finItems) {
        doc.setDrawColor(235, 240, 245);
        doc.line(20, currentY + 7, 190, currentY + 7);

        doc.setFont('Helvetica', 'bold');
        doc.text(item.label, 24, currentY + 45 / 10);
        doc.setFont('Helvetica', 'normal');
        doc.text(item.val || "N/A", 95, currentY + 45 / 10);

        currentY += 8;
      }
    }

    // ==========================================
    // PAGE 4: RISK ASSESSMENT & COMPETITORS
    // ==========================================
    doc.addPage();
    pageNumber++;
    addPageDecoration(pageNumber);

    currentY = 25;

    // Header title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("4. RISKS PROFILE & COMPETITIVE THREAT MAP", 20, currentY);
    
    currentY += 6;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.6);
    doc.line(20, currentY, 190, currentY);

    // Section 4A: Risk Assessment
    if (report.riskAssessment) {
      currentY += 8;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text("A. DECLARED STRATEGIC RISKS & REMEDIATION PROJECTION", 20, currentY);
      
      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 65, 70);
      currentY = writeWrappedText(report.riskAssessment.summary, 20, currentY, 170);

      currentY += 4;
      currentY = ensureRemainingY(currentY, 45);

      for (const r of report.riskAssessment.risks.slice(0, 3)) { // print top 3 key risks
        currentY = ensureRemainingY(currentY, 32);

        doc.setFillColor(254, 242, 242);
        doc.rect(20, currentY, 170, 23, 'F');
        doc.setDrawColor(252, 165, 165);
        doc.setLineWidth(0.3);
        doc.rect(20, currentY, 170, 23, 'D');

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(153, 27, 27);
        doc.text(`RISK THREAT: ${r.risk.toUpperCase()} [SEVERITY: ${r.severity}]`, 24, currentY + 6);

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(50, 55, 60);
        writeWrappedText(`Impact: ${r.impact}`, 24, currentY + 11, 160, 4);
        writeWrappedText(`Proposed Active Mitigation: ${r.mitigation}`, 24, currentY + 17, 160, 4);

        currentY += 27;
      }
    }

    currentY = ensureRemainingY(currentY, 60);

    // Section 4B: Competitors List
    if (report.competitionAnalysis) {
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text("B. DIRECT LOCAL COMPETITOR ASSET LOG", 20, currentY);
      
      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(60, 65, 70);
      currentY = writeWrappedText(report.competitionAnalysis.summary, 20, currentY, 170);

      currentY += 4;

      if (report.competitionAnalysis.competitors && report.competitionAnalysis.competitors.length > 0) {
        for (const comp of report.competitionAnalysis.competitors.slice(0, 3)) { // print top 3 competitors
          currentY = ensureRemainingY(currentY, 18);

          doc.setDrawColor(230, 235, 240);
          doc.setLineWidth(0.3);
          doc.line(20, currentY + 14, 190, currentY + 14);

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(30, 35, 40);
          doc.text(`⚔️ ${comp.name}`, 24, currentY + 4);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 105, 110);
          doc.text(comp.address || "Address coordinates log dynamic", 24, currentY + 8);

          doc.setFontSize(8.5);
          doc.setTextColor(60, 65, 70);
          doc.text(comp.details || "Direct catalog competitor focus profile matches.", 24, currentY + 12);

          currentY += 16;
        }
      }
    }

    // ==========================================
    // PAGE 5: REGIONAL INTEL & AI VERDICT
    // ==========================================
    doc.addPage();
    pageNumber++;
    addPageDecoration(pageNumber);

    currentY = 25;

    // Header title
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("5. REGIONAL ECONOMIC INTEL & DIRECTIVES", 20, currentY);
    
    currentY += 6;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.6);
    doc.line(20, currentY, 190, currentY);

    const isRegionalUnlocked = canViewRegionalIntelligence(plan);
    const hasRegData = regionalData || report.regionalIntelligence;

    if (!isRegionalUnlocked) {
      currentY += 8;
      doc.setFillColor(243, 232, 255);
      doc.rect(20, currentY, 170, 35, 'F');
      doc.setDrawColor(147, 51, 234);
      doc.setLineWidth(0.5);
      doc.rect(20, currentY, 170, 35, 'D');

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(107, 33, 168);
      doc.text("🔒 PRO+ REGIONAL STUDY PARAMETERS EXCLUDED IN EXPORT", 26, currentY + 8);
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(126, 34, 206);
      currentY += 14;
      currentY = writeWrappedText("Regional Intelligence analysis including nearby ZIP comparisons, county context, and expansion strategy is available on the Pro+ plan and above. Upgrade your subscription to include regional data in future exports.", 26, currentY, 158, 4.5);
    } else if (hasRegData) {
      const rd = regionalData || report.regionalIntelligence;
      currentY += 8;
      
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(pColor[0], pColor[1], pColor[2]);
      doc.text(`Multi-District Opportunity Snapshot for ${report.location}`, 20, currentY);

      currentY += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(60, 65, 70);
      currentY = writeWrappedText(rd.countyContext || "Regional adjacent neighborhood characteristics modeled correctly.", 20, currentY, 170);

      if (rd.nearbyRegions && rd.nearbyRegions.length > 0) {
        currentY += 6;
        currentY = ensureRemainingY(currentY, 40);

        // Grid Table Headers
        doc.setFillColor(lColor[0], lColor[1], lColor[2]);
        doc.rect(20, currentY, 170, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(pColor[0], pColor[1], pColor[2]);
        doc.text(rd.isZipMode ? "TARGET ZIP SECTOR" : "SUB-SECTOR SUBURB", 24, currentY + 5);
        doc.text(rd.isZipMode ? "INCOME BENCHMARK" : "GROWTH STATUS", 75, currentY + 5);
        doc.text(rd.isZipMode ? "COMPETITOR CONTIGUOUS" : "SATURATION LEVEL", 130, currentY + 5);

        currentY += 7;
        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(60, 65, 70);

        for (const reg of rd.nearbyRegions) {
          currentY = ensureRemainingY(currentY, 12);

          doc.setDrawColor(240, 242, 245);
          doc.line(20, currentY + 7, 190, currentY + 7);

          doc.setFont('Helvetica', 'bold');
          doc.text(reg.name, 24, currentY + 45 / 10);
          
          doc.setFont('Helvetica', 'normal');
          doc.text(reg.demographics || reg.growthStatus || "Stable", 75, currentY + 45 / 10);
          doc.text(reg.competition || reg.saturation || "Moderate", 130, currentY + 45 / 10);

          currentY += 8;
        }
      }

      currentY += 4;
      currentY = ensureRemainingY(currentY, 45);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text("Strategic Regional Playbook Recommendation Summary", 20, currentY);

      currentY += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(80, 85, 90);
      currentY = writeWrappedText(rd.regionalRecommendation || rd.expansionPotential, 20, currentY, 170, 4.5);
    } else {
      currentY += 8;
      doc.setFont('Helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(120, 125, 130);
      doc.text("No specific regional datasets were staged during standard dossier synthesis.", 20, currentY);
    }

    currentY = ensureRemainingY(currentY, 65);

    // Ultimate Venture Recommendation Verdict
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text("6. FINAL CORPORATE VENTURE VERDICT", 20, currentY);
    
    currentY += 4;
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.4);
    doc.line(20, currentY, 190, currentY);

    currentY += 8;
    doc.setFillColor(lColor[0], lColor[1], lColor[2]);
    doc.rect(20, currentY, 170, 32, 'F');
    doc.setDrawColor(pColor[0], pColor[1], pColor[2]);
    doc.setLineWidth(0.3);
    doc.rect(20, currentY, 170, 32, 'D');

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(pColor[0], pColor[1], pColor[2]);
    doc.text(`VERDICT DECISION: ${report.recommendation?.decision?.toUpperCase() || "CAUTION ADVISED"}`, 25, currentY + 8);

    doc.setFont('Helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(50, 55, 60);
    writeWrappedText(`"${report.recommendation?.reasoning || "Reasoning factors and mitigation elements compiled completely."}"`, 25, currentY + 14, 160, 4.5);

    // Save final action
    const safeFileName = `BizScope_Viability_Dossier_${report.businessType.replace(/\s+/g, '_')}_${report.location.replace(/\s+/g, '_')}.pdf`;
    doc.save(safeFileName);
  }
}
