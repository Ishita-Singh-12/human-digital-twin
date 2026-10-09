"""Nested participant-disjoint WESAD comparisons; no subject/time/phase features."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedGroupKFold,GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import balanced_accuracy_score,accuracy_score,confusion_matrix,f1_score
ROOT=Path(__file__).parent
GRID=[{'model':[LogisticRegression(max_iter=3000,class_weight='balanced',random_state=42)],'model__C':[.1,1]},
      {'model':[SVC(class_weight='balanced')],'model__C':[1,10]},
      {'model':[RandomForestClassifier(n_estimators=150,class_weight='balanced',random_state=42,n_jobs=1)],'model__max_depth':[4,8],'model__min_samples_leaf':[4]}]
def evaluate(frame,features):
    x=frame[features];y=frame.stress_label.to_numpy();g=frame.subject_id.to_numpy();pred=np.zeros(len(y),dtype=int);folds=[]
    for train,test in StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=42).split(x,y,g):
        assert not set(g[train])&set(g[test])
        cv=StratifiedGroupKFold(n_splits=3,shuffle=True,random_state=42)
        search=GridSearchCV(Pipeline([('scale',StandardScaler()),('model',LogisticRegression())]),GRID,cv=cv,scoring='balanced_accuracy',n_jobs=1)
        search.fit(x.iloc[train],y[train],groups=g[train]);pred[test]=search.predict(x.iloc[test])
        folds.append({'train_subjects':sorted(set(g[train])),'test_subjects':sorted(set(g[test])),'balanced_accuracy':float(balanced_accuracy_score(y[test],pred[test])),
                      'selected_model':type(search.best_estimator_.named_steps['model']).__name__,'inner_balanced_accuracy':float(search.best_score_)})
    rng=np.random.default_rng(42);boot=[];subjects=np.unique(g)
    for _ in range(2000):
        selected=rng.choice(subjects,len(subjects),replace=True);ix=np.concatenate([np.flatnonzero(g==s) for s in selected]);boot.append(balanced_accuracy_score(y[ix],pred[ix]))
    subject_scores=[{'subject':s,'balanced_accuracy':float(balanced_accuracy_score(y[g==s],pred[g==s]))} for s in subjects]
    result={'windows':len(y),'subjects':len(subjects),'features':features,'balanced_accuracy':float(balanced_accuracy_score(y,pred)),
            'accuracy':float(accuracy_score(y,pred)),'macro_f1':float(f1_score(y,pred,average='macro')),'subject_bootstrap_95ci':np.percentile(boot,[2.5,97.5]).tolist(),
            'confusion_matrix':confusion_matrix(y,pred).tolist(),'folds':folds,'subject_scores':subject_scores}
    return result,pred

def main():
    frame=pd.read_csv(ROOT/'data/wesad_features.csv');sets={'wrist_eda':[c for c in frame if c.startswith('wrist_eda_')],
        'wrist_multimodal':[c for c in frame if c.startswith('wrist_')],
        'wrist_chest':[c for c in frame if c.startswith(('wrist_','chest_'))]}
    results={'dataset':'WESAD official archive','target':'stress (phase 2) vs baseline/amusement (phases 1/3)',
             'protocol':'60-second non-overlapping pure-phase windows; nested 5 outer/3 inner participant-disjoint folds; train-only scaling/model selection; same feature-valid cohort in every comparison',
             'uncertainty':'Subject bootstrap conditional on these OOF predictions. Not external or daily-life validation. Different dataset/task from QoL_Stress; percentages cannot be compared as a direct uplift.', 'results':{}}
    oof=frame[['subject_id','window_start_sec','phase','stress_label']].copy()
    for name,features in sets.items():
        result,pred=evaluate(frame,features);results['results'][name]=result;oof[name+'_prediction']=pred
        print(name,result['balanced_accuracy'],result['accuracy'],result['subject_bootstrap_95ci'],flush=True)
        (ROOT/'data/wesad_evaluation.json').write_text(json.dumps(results,indent=2)+'\n')
    oof.to_csv(ROOT/'data/wesad_oof.csv',index=False)
    import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
    names=list(sets);scores=[results['results'][n]['balanced_accuracy']*100 for n in names]
    ci=np.array([results['results'][n]['subject_bootstrap_95ci'] for n in names])*100
    fig,ax=plt.subplots(figsize=(8,4.8));ax.bar(['Wrist EDA','Wrist multi-signal','Wrist + chest'],scores,color=['#abcac1','#73a89a','#477e70'])
    ax.errorbar(range(3),scores,yerr=np.stack([np.array(scores)-ci[:,0],ci[:,1]-np.array(scores)]),fmt='none',color='#251f21',capsize=5)
    ax.axhline(50,color='#999',linestyle='--');ax.set_ylim(0,100);ax.set_ylabel('Balanced accuracy (%)');ax.set_title('WESAD: nested participant-disjoint lab evaluation')
    for i,s in enumerate(scores):ax.text(i,s+1,f'{s:.1f}%',ha='center')
    fig.text(.5,.01,'15 participants; 60s non-overlapping windows. Conditional subject-bootstrap 95% intervals.\nResearch benchmark, not personal-health validation.',ha='center',fontsize=9)
    fig.tight_layout(rect=(0,.07,1,1));fig.savefig(ROOT/'data/wesad_comparison.png',dpi=160);plt.close(fig)
if __name__=='__main__':main()
