from flask import Flask, jsonify, request
import subprocess
import time

app = Flask(__name__)

# Track uptime and process
start_time = None
bot_process = None

def format_uptime(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    return f"{hours}h {minutes}m {secs}s"

@app.route('/start', methods=['POST'])
def start_bot():
    global bot_process, start_time
    if bot_process is None or bot_process.poll() is not None:
        bot_process = subprocess.Popen(["node", "index.js"])  # Adjust if needed
        start_time = time.time()
        return jsonify({"message": "Bot started"}), 200
    return jsonify({"message": "Bot is already running"}), 400

@app.route('/stop', methods=['POST'])
def stop_bot():
    global bot_process
    if bot_process and bot_process.poll() is None:
        bot_process.terminate()
        bot_process = None
        return jsonify({"message": "Bot stopped"}), 200
    return jsonify({"message": "Bot is not running"}), 400

@app.route('/restart', methods=['POST'])
def restart_bot():
    stop_bot()
    time.sleep(2)
    return start_bot()

@app.route('/status', methods=['GET'])
def status():
    global bot_process, start_time
    is_online = bot_process and bot_process.poll() is None
    uptime = format_uptime(time.time() - start_time) if is_online and start_time else "0h 0m 0s"
    return jsonify({"online": is_online, "uptime": uptime})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000)
