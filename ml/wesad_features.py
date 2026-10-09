"""Official WESAD archive -> non-overlapping 60s signal windows.
Restricted unpickling permits only numpy numeric-array reconstruction. No user pickle uploads.
"""
import argparse, gc, hashlib, io, json, pickle, zipfile
from pathlib import Path
import numpy as np
import pandas as pd
from scipy.signal import find_peaks, butter, sosfiltfilt

class NumericUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module in ('numpy','numpy.core.multiarray','numpy._core.multiarray') and name in ('ndarray','dtype','_reconstruct','scalar'):
            if name in ('ndarray','dtype'): return getattr(np,name)
            return getattr(np._core.multiarray,name)
        if module == '_codecs' and name == 'encode':
            import codecs
            return codecs.encode
        raise pickle.UnpicklingError(f'Forbidden pickle global: {module}.{name}')

def stats(x, prefix, fs):
    x=np.asarray(x,dtype=float).reshape(-1)
    if len(x)<10 or not np.isfinite(x).all(): raise ValueError('Nonfinite or short signal')
    t=np.arange(len(x))/fs
    return {prefix+'_mean':float(x.mean()),prefix+'_std':float(x.std()),prefix+'_min':float(x.min()),prefix+'_max':float(x.max()),
            prefix+'_iqr':float(np.percentile(x,75)-np.percentile(x,25)),prefix+'_slope':float(np.polyfit(t,x,1)[0]),
            prefix+'_diff_mean':float(np.abs(np.diff(x)).mean())}

def pulse_features(x,fs,prefix,band=(.7,3.5)):
    x=np.asarray(x,dtype=float).reshape(-1)
    filtered=sosfiltfilt(butter(3,band,btype='bandpass',fs=fs,output='sos'),x)
    peaks,_=find_peaks(filtered,distance=int(fs*.3),prominence=max(filtered.std()*.3,1e-8))
    rr=np.diff(peaks)/fs
    rr=rr[(rr>=.3)&(rr<=1.5)]
    if len(rr)<10: raise ValueError('Pulse quality insufficient')
    return {prefix+'_hr':float(60/np.median(rr)),prefix+'_interval_std':float(rr.std()),prefix+'_rmssd':float(np.sqrt(np.mean(np.diff(rr)**2)))}

def window_features(signals,start,end):
    out={}
    for key,fs in [('EDA',4),('TEMP',4),('BVP',64)]:
        x=signals['wrist'][key][int(start*fs):int(end*fs)]
        out.update(stats(x,'wrist_'+key.lower(),fs))
        if key=='BVP':out.update(pulse_features(x,fs,'wrist_bvp'))
    for key in ['EDA','Temp','Resp']:
        x=signals['chest'][key][int(start*700):int(end*700):7] # documented 700Hz -> 100Hz for stats
        out.update(stats(x,'chest_'+key.lower(),100))
        if key=='Resp':
            filtered=sosfiltfilt(butter(3,[.1,.7],btype='bandpass',fs=100,output='sos'),np.asarray(x).reshape(-1))
            peaks,_=find_peaks(filtered,distance=100,prominence=max(filtered.std()*.3,1e-8))
            out['chest_resp_rate']=float(len(peaks)) # counts in exactly 60s
    # ECG heart-rate feature from native 700Hz; not claimed as validated clinical HRV.
    ecg=signals['chest']['ECG'][int(start*700):int(end*700)]
    out.update(pulse_features(ecg,700,'chest_ecg',(5,20)))
    return out

def extract(archive,output,subject=None):
    rows=[];quality=[]
    with zipfile.ZipFile(archive) as z:
        names=sorted(n for n in z.namelist() if n.endswith('.pkl') and (subject is None or n.split('/')[-2]==subject))
        for name in names:
            with z.open(name) as f: data=NumericUnpickler(f,encoding='latin1').load()
            subject=data['subject']; labels=np.asarray(data['label']); signal=data['signal']; count=0;skipped=0
            # Baseline/stress/amusement only. Never span phase boundaries or overlap windows.
            change=np.r_[0,np.flatnonzero(np.diff(labels)!=0)+1,len(labels)]
            for a,b in zip(change[:-1],change[1:]):
                phase=int(labels[a])
                if phase not in (1,2,3):continue
                for start in range(int(a),int(b)-42000+1,42000):
                    try: features=window_features(signal,start/700,(start+42000)/700)
                    except ValueError:skipped+=1;continue
                    rows.append({'subject_id':subject,'window_start_sec':start/700,'phase':phase,'stress_label':int(phase==2),**features});count+=1
            quality.append({'subject':subject,'valid_windows':count,'excluded_windows':skipped});print(quality[-1],flush=True)
            del data,labels,signal;gc.collect()
    frame=pd.DataFrame(rows);frame.to_csv(output,index=False)
    Path(str(output)+'.quality.json').write_text(json.dumps(quality,indent=2)+'\n')
    return frame

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('archive');p.add_argument('--output',default=str(Path(__file__).parent/'data/wesad_features.csv'));p.add_argument('--subject');args=p.parse_args();extract(args.archive,args.output,args.subject)
