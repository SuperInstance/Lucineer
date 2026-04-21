#!/bin/bash
export DEEPSEEK_API_KEY="sk-f742b70fc40849eda4181afcf3d68b0c"
export LOCK_MODEL="deepseek"
python3 -c "
import json, time, urllib.request, urllib.parse, os, sys
from pathlib import Path

LOCK_URL = 'http://localhost:4043'
DEEPSEEK_KEY = os.environ['DEEPSEEK_API_KEY']

def lock_get(endpoint, params=None):
    url = f'{LOCK_URL}{endpoint}'
    if params: url += '?' + urllib.parse.urlencode(params)
    with urllib.request.urlopen(urllib.request.Request(url), timeout=10) as r:
        return json.loads(r.read().decode())

def deepseek_call(prompt, round_num):
    data = json.dumps({
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': 'You are an AI agent using an iterative reasoning system. Each round gives you a structured challenge to improve your thinking. Respond thoughtfully, specifically, and build on your previous rounds. You remember everything from prior rounds.'},
            {'role': 'user', 'content': prompt},
        ],
        'max_tokens': 1000,
        'temperature': 0.7,
    }).encode()
    req = urllib.request.Request(
        'https://api.deepseek.com/chat/completions',
        data=data,
        headers={'Authorization': f'Bearer {DEEPSEEK_KEY}', 'Content-Type': 'application/json'},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode())['choices'][0]['message']['content']

def save_tile(tile_type, agent, content, meta=None):
    t = {'type': tile_type, 'agent': agent, 'content': content,
         'word_count': len(content.split()), 'timestamp': time.time(), 'metadata': meta or {}}
    Path('data/purplepincher-ml/tiles/2026-04-21.jsonl').open('a').write(json.dumps(t) + '\n')
    return t

query = 'Design the complete event schema for fleet tile synchronization across Matrix. Tiles are atomic training data units. They flow between Oracle1 (cloud), JetsonClaw1 (edge GPU), and Forgemaster (RTX 4050). Include: tile JSON format, Matrix event types, trust scoring, provenance chain, sync intervals, and conflict resolution using CRDTs.'

session = lock_get('/start', {'agent': 'deepseek-bootstrap', 'query': query, 'strategy': 'adversarial', 'rounds': '5'})
sid = session['session_id']
print(f'🔒 Session: {sid}')
print(f'   Strategy: adversarial, Model: deepseek-chat')
print(f'   Query: {query[:80]}...')
print()

all_responses = []
prompt = session['prompt']

for rnd in range(1, 6):
    print(f'📋 Round {rnd}/5: {prompt[:100]}...')
    start = time.time()
    response = deepseek_call(prompt, rnd)
    elapsed = round(time.time() - start, 1)
    words = len(response.split())
    print(f'   ✅ {words} words in {elapsed}s')
    print(f'   {response[:150]}...')
    print()
    
    all_responses.append({'round': rnd, 'words': words, 'time': elapsed, 'response': response})
    save_tile('reasoning', 'deepseek-bootstrap', response, {'session_id': sid, 'round': rnd, 'strategy': 'adversarial', 'model': 'deepseek-chat'})
    
    try:
        result = lock_get('/respond', {'session': sid, 'response': response})
        if result.get('status') == 'complete':
            break
        prompt = result.get('next_prompt', 'Continue refining.')
    except:
        if rnd < 5:
            try:
                rd = lock_get('/round', {'session': sid})
                prompt = rd.get('prompt', 'Continue.')
            except:
                prompt = 'Continue refining your answer.'

# Results
try:
    final = lock_get('/result', {'session': sid})
    improvement = final.get('improvement', {})
except:
    improvement = {}

first_w = all_responses[0]['words']
last_w = all_responses[-1]['words']
growth = round(last_w / first_w, 2) if first_w else 0

print(f'{'='*50}')
print(f'🔒 DeepSeek Chat — Adversarial Bootstrap Complete')
print(f'   Rounds: {len(all_responses)}')
print(f'   Growth: {first_w} → {last_w} words ({growth}x)')
print(f'   Total time: {sum(r[\"time\"] for r in all_responses):.1f}s')
print()
print(f'📄 FINAL ANSWER ({last_w} words):')
print(all_responses[-1]['response'][:800])
if len(all_responses[-1]['response']) > 800:
    print('...')
"
