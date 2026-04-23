/**
 * CompanyInfoBlock — mandatory PND INC business disclosure block.
 * Displayed in the footer (Korean e-commerce regulatory requirement).
 */
import { COMPANY_INFO } from "@/lib/legal/content";

const CompanyInfoBlock = () => (
  <div className="text-[10px] leading-[1.7] text-foreground/55">
    <p className="font-semibold text-foreground/70">{COMPANY_INFO.name} · {COMPANY_INFO.site}</p>
    <p>사업자등록번호 {COMPANY_INFO.businessReg} · 통신판매업신고 {COMPANY_INFO.ecomReg}</p>
    <p>{COMPANY_INFO.address}</p>
    <p>Tel. {COMPANY_INFO.phone} · {COMPANY_INFO.supportEmail}</p>
  </div>
);

export default CompanyInfoBlock;
