const express = require('express');
const fetch = require('node-fetch');
const app = express();
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const GITHUB_TOKEN = process.env.GTHUB_TOKEN;
const OWNER = 'VRGamerz9797';
const REPO = 'discord-bot';
const WORKFLOW_FILE = 'bot.yml'; // Replace with your actual workflow file name

async function triggerWorkflow(action) {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GTHUB_TOKEN}`,
            'Accept': 'application/vnd.github+json'
        },
        body: JSON.stringify({
            ref: 'main',
            inputs: { action }
        })
    });
    return response.ok;
}

app.post('/:command(start|stop|restart)', async (req, res) => {
    const command = req.params.command;
    const success = await triggerWorkflow(command);
    res.json({ success });
});

app.listen(PORT, () => {
    console.log(`✅ Backend server running on port ${PORT}`);
});
