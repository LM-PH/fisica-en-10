import urllib.request
import json
import re
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

project = 'fisica-en-10'
url = f'https://firestore.googleapis.com/v1/projects/{project}/databases/(default)/documents/preguntas?pageSize=300'

print("Fetching questions...")
req = urllib.request.Request(url)
with urllib.request.urlopen(req) as response:
    data = json.loads(response.read().decode())

docs = data.get('documents', [])
print(f"Found {len(docs)} questions.")

updated = 0
for doc in docs:
    name = doc['name']
    text = doc['fields']['pregunta']['stringValue']
    
    if re.search(r'\s\(V\d+\)$', text):
        new_text = re.sub(r'\s\(V\d+\)$', '', text)
        doc['fields']['pregunta']['stringValue'] = new_text
        
        patch_url = f"https://firestore.googleapis.com/v1/{name}?updateMask.fieldPaths=pregunta"
        patch_req = urllib.request.Request(patch_url, data=json.dumps(doc).encode('utf-8'), method='PATCH')
        patch_req.add_header('Content-Type', 'application/json')
        
        try:
            with urllib.request.urlopen(patch_req) as p_res:
                updated += 1
        except Exception as e:
            print(f"Failed to update {name}: {e}")

print(f"Updated {updated} questions.")
