const project = 'fisica-en-10';
const url = `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents/preguntas`;

async function cleanQuestions() {
    console.log("Fetching questions to clean up...");
    const res = await fetch(url + '?pageSize=300');
    const data = await res.json();
    
    if (!data.documents) {
        console.log("No questions found.");
        return;
    }

    let updatedCount = 0;
    
    for (let doc of data.documents) {
        let questionText = doc.fields.pregunta.stringValue;
        // Check if it has (V...)
        if (questionText.match(/\s\(V\d+\)$/)) {
            // Remove the match
            const cleanedText = questionText.replace(/\s\(V\d+\)$/, '');
            
            // Build update payload
            doc.fields.pregunta.stringValue = cleanedText;
            
            // Send PATCH request
            const patchRes = await fetch(`https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=pregunta`, {
                method: 'PATCH',
                body: JSON.stringify(doc),
                headers: { 'Content-Type': 'application/json' }
            });
            
            if (patchRes.ok) {
                updatedCount++;
            } else {
                console.error("Failed to update doc:", doc.name);
            }
        }
    }
    
    console.log(`Successfully cleaned ${updatedCount} questions.`);
}

cleanQuestions().catch(console.error);
