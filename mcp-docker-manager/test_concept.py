#!/usr/bin/env python3
"""
Test rapide du concept MCP avec Docker
Lance un conteneur MCP en mode interactif et gère stdin/stdout via subprocess
"""

import subprocess
import json
import threading
import time
import sys

class MCPDockerClient:
    def __init__(self, image):
        self.image = image
        self.process = None
        self.output_thread = None
        self.responses = []

    def start(self):
        """Démarre le conteneur en mode interactif"""
        print(f"Démarrage du conteneur {self.image}...")
        self.process = subprocess.Popen(
            ["docker", "run", "--rm", "-i", self.image],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1
        )

        # Lance une thread pour lire stdout
        self.output_thread = threading.Thread(target=self._read_output, daemon=True)
        self.output_thread.start()

        print("Conteneur démarré, waiting for startup messages...")
        time.sleep(1)  # Attendre que les messages de démarrage passent

    def _read_output(self):
        """Thread qui lit continuellement stdout et filtre les JSON"""
        print("[Thread] Démarrage de la lecture...")
        while True:
            line = self.process.stdout.readline()
            if not line:
                print("[Thread] EOF détecté")
                break

            line = line.strip()
            print(f"[Thread] Ligne reçue: {line}")

            # Essayer de parser comme JSON
            try:
                data = json.loads(line)
                print(f"[Thread] JSON valide détecté, ajout à la queue")
                self.responses.append(data)
            except json.JSONDecodeError:
                print(f"[Thread] Ligne non-JSON ignorée: {line}")

    def initialize(self):
        """Envoie la requête initialize"""
        print("\nEnvoi de la requête initialize...")
        req = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {
                    "name": "test-client",
                    "version": "1.0.0"
                }
            }
        }

        req_json = json.dumps(req)
        print(f"Requête: {req_json}")
        self.process.stdin.write(req_json + "\n")
        self.process.stdin.flush()

        # Attendre la réponse
        print("Attente de la réponse...")
        timeout = 10
        start = time.time()
        while time.time() - start < timeout:
            if self.responses:
                resp = self.responses.pop(0)
                print(f"Réponse reçue: {json.dumps(resp, indent=2)}")
                return resp
            time.sleep(0.1)

        print("TIMEOUT!")
        return None

    def stop(self):
        """Arrête le conteneur"""
        if self.process:
            self.process.terminate()
            self.process.wait()
            print("Conteneur arrêté")

if __name__ == "__main__":
    client = MCPDockerClient("mcp/filesystem:latest")

    try:
        client.start()
        result = client.initialize()

        if result:
            print("\n✅ SUCCESS! Le concept fonctionne!")
        else:
            print("\n❌ FAILED: Pas de réponse")

    finally:
        client.stop()
