
import { v4 as uuidv4 } from 'uuid';

async function main() {
    const port = process.env.PORT || 3000;
    const url = `http://localhost:${port}/a2a`;

    const payload = {
        jsonrpc: '2.0',
        method: 'message/send',
        id: 1,
        params: {
            message: {
                role: 'user',
                parts: [{ type: 'text', text: 'Please transfer 0.0001 ETH to 0xcFcF607971ad68AE5E0FBCea64d129449adf7Cd1' }]
            },
            configuration: {
                contextId: uuidv4()
            }
        }
    };

    console.log('📤 Sending request to Agent...');
    console.log(`Payload: "${payload.params.message.parts[0].text}"`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (data.error) {
            console.error('❌ Error response:', JSON.stringify(data.error, null, 2));
        } else {
            console.log('\n✅ Response received!');
            const fs = require('fs');
            fs.writeFileSync('debug-response.json', JSON.stringify(data, null, 2));
            console.log('Full response saved to debug-response.json');

            const agentResponse = data.result.messages.find((m: any) => m.role === 'agent');
            const text = agentResponse?.parts[0]?.text;

            console.log('🤖 Agent says:\n', text);
        }
    } catch (error) {
        console.error('❌ Connection failed. Is the server running on port 3000?', error);
    }
}

main();
