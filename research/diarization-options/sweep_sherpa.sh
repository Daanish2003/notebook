#!/bin/bash
# usage: sweep_sherpa.sh NAME OFFSET T0 T1 "emb1 emb2" "thr1 thr2" [threads] [provider]
# NAME is clip|ep209|ep283 (wav in $A), OFFSET added to turns to match ref time base.
W=${DIAR_WORK:?set DIAR_WORK to a scratch dir with ref/, out/, MODELDIR and work/ (these scripts)}
M=$(cat $W/MODELDIR); A=${DIAR_AUDIO:?dir with clip.wav ep209.wav ep283.wav (16 kHz mono)}
NAME=$1; OFF=$2; T0=$3; T1=$4; EMBS=$5; THRS=$6; TH=${7:-12}; PROV=${8:-cpu}
REF=$W/ref/ep209.ref.json; [ "$NAME" = ep283 ] && REF=$W/ref/ep283.ref.json
for e in $EMBS; do for t in $THRS; do
  o=$W/out/$NAME.sherpa.${e%%.onnx}.$t.$PROV.json
  (cd ${SHERPA_PROJECT:?uv project with sherpa-onnx} && uv run python $W/work/run_sherpa.py $M $A/$NAME.wav $o $e $t $TH $PROV >/dev/null 2>$o.err)
  python3 - "$o" "$OFF" <<'EOF'
import json,sys
d=json.load(open(sys.argv[1])); off=float(sys.argv[2])
for x in d['turns']: x['start']+=off; x['end']+=off
json.dump(d,open(sys.argv[1]+'.abs','w'))
EOF
  (cd $W/work && python3 score.py $REF $o.abs $T0 $T1) >> $W/out/scores.jsonl
  tail -1 $W/out/scores.jsonl | cut -c1-400
done; done
