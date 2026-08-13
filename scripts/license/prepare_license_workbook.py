"""Read-only validator/exporter for realestate, insurance, mortgage and notary."""
import argparse, json
from datetime import date, datetime
from pathlib import Path
from openpyxl import load_workbook

PRODUCTS=("realestate","insurance","mortgage","notary")
REQUIRED=("N","Q_EN","Q_KO","1_EN","1_KO","2_EN","2_KO","3_EN","3_KO","4_EN","4_KO","A","E_EN","E_KO","QUESTION_ID","SOURCE_SHEET","STATUS")
def clean(v):
    if v is None:return None
    if isinstance(v,(date,datetime)):return v.isoformat()
    return (v.strip() or None) if isinstance(v,str) else v
def sheet_rows(sheet):
    it=sheet.iter_rows(values_only=True); headers=[str(v or "").strip() for v in next(it)]
    for raw in it:
        if any(v not in (None,"") for v in raw):yield {headers[i]:clean(v) for i,v in enumerate(raw) if i<len(headers) and headers[i]}
def main():
    p=argparse.ArgumentParser();p.add_argument("workbook",type=Path);p.add_argument("--output",type=Path,default=Path("factory-output/license/license-import.json"));p.add_argument("--report",type=Path,default=Path("factory-output/license/license-validation-report.json"));a=p.parse_args()
    wb=load_workbook(a.workbook,read_only=True,data_only=True); problems=[]; questions=[];translations=[];reviews=[];seen=set();counts={}
    for product in PRODUCTS:
        if product not in wb.sheetnames:problems.append({"type":"missing_sheet","sheet":product});continue
        rows=list(sheet_rows(wb[product])); missing=[h for h in REQUIRED if h not in (rows[0].keys() if rows else [])]
        if missing:problems.append({"type":"missing_headers","sheet":product,"headers":missing});continue
        accepted=[]
        for row_no,row in enumerate(rows,start=2):
            qid=str(row.get("QUESTION_ID") or "");errors=[]
            try:answer=int(row.get("A"))
            except (ValueError,TypeError):answer=0
            if not qid or qid in seen:errors.append("missing/duplicate QUESTION_ID")
            if str(row.get("SOURCE_SHEET") or "").lower()!=product:errors.append("SOURCE_SHEET mismatch")
            if answer not in (1,2,3,4):errors.append("A not 1..4")
            for f in ("Q_EN","Q_KO","1_EN","1_KO","2_EN","2_KO","3_EN","3_KO","4_EN","4_KO","E_EN","E_KO"):
                if not row.get(f):errors.append(f+" missing")
            if row.get("STATUS")!="GENERATED_READY" or row.get("ANSWER_CHECK")!="PASS" or row.get("TRANSLATION_CHECK")!="PASS":errors.append("quality gate failed")
            if errors:problems.append({"type":"rejected","sheet":product,"row":row_no,"question_id":qid,"errors":errors});continue
            seen.add(qid);accepted.append((row,qid,answer))
        counts[product]={"accepted":len(accepted),"sample":min(20,len(accepted))}
        for order,(r,qid,answer) in enumerate(accepted,1):
            questions.append({"question_id":qid,"product_code":product,"sequence_number":order,"subject":r.get("SUBJECT"),"category":r.get("CATEGORY"),"answer":answer,"graphic":r.get("G"),"is_sample":order<=20,"sample_order":order if order<=20 else None,"status":"published","source_id":r.get("SOURCE_ID"),"source_n":r.get("SOURCE_N"),"source_sheet":product})
            for lang in ("EN","KO"):translations.append({"question_id":qid,"language_code":lang.lower(),"question_text":r[f"Q_{lang}"],"passage_text":r.get(f"P_{lang}"),"option_1":r[f"1_{lang}"],"option_2":r[f"2_{lang}"],"option_3":r[f"3_{lang}"],"option_4":r[f"4_{lang}"],"explanation":r.get(f"E_{lang}")})
            reviews.append({"question_id":qid,**{k.lower():r.get(k) for k in ("SOURCE_QUALITY","SOURCE_ISSUE","ANSWER_CHECK","AMBIGUITY_CHECK","TRANSLATION_CHECK","TRANSLATION_ISSUE","CONCEPT_SUMMARY","CHANGE_SUMMARY","BATCH_ID","CUSTOM_ID","GENERATED_AT")}})
    report={"products":counts,"accepted_questions":len(questions),"rejected_rows":sum(x["type"]=="rejected" for x in problems),"problems":problems}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.report.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps({"questions":questions,"translations":translations,"reviews":reviews},ensure_ascii=False,indent=2),encoding="utf8");a.report.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf8");print(json.dumps({k:v for k,v in report.items() if k!="problems"},indent=2));
    if not questions:raise SystemExit(1)
if __name__=="__main__":main()
