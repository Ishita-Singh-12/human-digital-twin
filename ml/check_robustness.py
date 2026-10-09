import json
from evaluate_upgrade import *
f=pd.read_csv(ROOT/'data/qol_features.csv')
common=f.dropna(subset=HRV+EDA);counts=common.groupby('subject_id').stress_label.nunique();common=common[common.subject_id.isin(counts[counts==2].index)]
results={}
for seed in [17,73]:
 results[str(seed)]={}
 for name in ['bpm','eda']:
  r=evaluate(common,FEATURE_SETS[name],seed);results[str(seed)][name]=r
  print(seed,name,r['balanced_accuracy'],flush=True)
eda=f.dropna(subset=EDA);counts=eda.groupby('subject_id').stress_label.nunique();eda=eda[eda.subject_id.isin(counts[counts==2].index)]
r=evaluate(eda,EDA);results['eda_all_valid_paired']=r;print('EDA full cohort',r['records'],r['subjects'],r['balanced_accuracy'],flush=True)
(ROOT/'data/model_robustness.json').write_text(json.dumps(results,indent=2)+'\n')
