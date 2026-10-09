"""Nested grouped evaluation. Neither identifiers nor phase/time metadata are features."""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, balanced_accuracy_score, roc_auc_score, confusion_matrix
from sklearn.model_selection import StratifiedGroupKFold, GridSearchCV
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from extract_features import HRV, EDA

ROOT=Path(__file__).resolve().parent
FEATURE_SETS={"bpm": ["heart_rate"], "hrv": ["heart_rate"]+HRV, "eda": EDA, "hrv_eda": ["heart_rate"]+HRV+EDA}
GRID=[
 {"model":[LogisticRegression(max_iter=2000,class_weight="balanced",random_state=42)],"model__C":[.1,1,10]},
 {"model":[SVC(kernel="rbf",class_weight="balanced")],"model__C":[.1,1,10],"model__gamma":["scale"]},
 {"model":[RandomForestClassifier(n_estimators=200,class_weight="balanced",random_state=42,n_jobs=1)],"model__max_depth":[2,4],"model__min_samples_leaf":[4,8]},
]

def evaluate(frame,features,seed=42):
    x=frame[features];y=frame.stress_label.to_numpy();groups=frame.subject_id.to_numpy()
    outer=StratifiedGroupKFold(n_splits=5,shuffle=True,random_state=seed)
    predicted=np.zeros(len(frame),dtype=int);scores=np.zeros(len(frame));folds=[]
    for train,test in outer.split(x,y,groups):
        assert not set(groups[train]) & set(groups[test])
        inner=StratifiedGroupKFold(n_splits=3,shuffle=True,random_state=42)
        search=GridSearchCV(Pipeline([("scale",StandardScaler()),("model",LogisticRegression())]),GRID,scoring="balanced_accuracy",cv=inner,n_jobs=1)
        search.fit(x.iloc[train],y[train],groups=groups[train])
        predicted[test]=search.predict(x.iloc[test])
        m=search.best_estimator_
        score=m.decision_function(x.iloc[test]) if hasattr(m,"decision_function") else m.predict_proba(x.iloc[test])[:,1]
        # ROC AUC below uses predictions as ordinal score so heterogeneous decision/probability scales are not mixed.
        scores[test]=score
        folds.append({"subjects_test":len(set(groups[test])),"accuracy":float(accuracy_score(y[test],predicted[test])),"model":type(m.named_steps['model']).__name__,"inner_balanced_accuracy":float(search.best_score_)})
    rng=np.random.default_rng(42);unique=np.unique(groups);boot=[]
    for _ in range(2000):
        chosen=rng.choice(unique,len(unique),replace=True);idx=np.concatenate([np.flatnonzero(groups==g) for g in chosen])
        if len(np.unique(y[idx]))==2: boot.append(balanced_accuracy_score(y[idx],predicted[idx]))
    return {"records":len(frame),"subjects":int(frame.subject_id.nunique()),"accuracy":float(accuracy_score(y,predicted)),"balanced_accuracy":float(balanced_accuracy_score(y,predicted)),"subject_bootstrap_95ci":np.percentile(boot,[2.5,97.5]).tolist(),"confusion_matrix":confusion_matrix(y,predicted).tolist(),"folds":folds}

if __name__=='__main__':
    frame=pd.read_csv(ROOT/'data/qol_features.csv')
    results={"protocol":"5 outer / 3 inner grouped folds; scaler and model selection fit inside training folds; participant-bootstrap CI is conditional on these out-of-fold predictions", "results":{}}
    # Both phase records must be valid for the common comparison cohort.
    common=frame.dropna(subset=HRV+EDA)
    paired=common.groupby('subject_id').stress_label.nunique();common=common[common.subject_id.isin(paired[paired==2].index)]
    for name,features in FEATURE_SETS.items():
        r=evaluate(common,features);results['results'][name]=r
        print(name,json.dumps({k:v for k,v in r.items() if k!='folds'}),flush=True)
    (ROOT/'data/model_evaluation.json').write_text(json.dumps(results,indent=2)+'\n')
