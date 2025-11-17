# ECG Binary Annotator Backend

Backend built with **Go**, **Echo v4**, **GORM**, and **SQLite**.
This service manages binary ECG files, YAML configuration files, and exposes routes to upload, list, and download these resources.

---

## 📁 API Routes

### ### 1. **Upload Endpoints**

#### **POST /upload/binary**

Upload a binary file (e.g., ECG proprietary format).

**Multipart form fields:**

- `file` (required) — the binary file
- `name` (optional) — custom name, otherwise file name is used
- `vendor` (optional) — manufacturer (e.g., "Schiller", "NihonKohden")

**Response:**

- 200 OK + created record metadata

---

#### **POST /upload/yaml**

Upload a YAML configuration file.

**Two supported formats:**

- Multipart upload (`file`)
- Direct YAML string (`yaml`)

**Optional fields:**

- `name` — the configuration name
- `file_name` — associated binary file name

**Response:**

- 200 OK + created YAML config metadata

---

## 📄 Listing Endpoints

#### **GET /get/list/binary**

Returns the list of all stored binary files.

**Response example:**

```json
[
  {
    "id": 1,
    "name": "example.dat",
    "vendor": "Schiller",
    "size": 102400,
    "created_at": 1731869200
  }
]
```

---

#### **GET /get/list/yaml**

Returns the list of all YAML configuration entries.

**Response example:**

```json
[
  {
    "id": 1,
    "name": "schiller_header",
    "file_name": "holter01.mkf",
    "created_at": 1731869210
  }
]
```

---

## 📥 Download Endpoints

#### **GET /get/binary/:fileName**

Download a binary file by name.

**Returns:**

- HTTP file download stream

---

#### **GET /get/yaml/:configName**

Retrieve a YAML configuration by name.

**Returns:**

- Plain text YAML

---

## 🛠 Extra Utility Routes

#### **GET /health**

Health check for the backend API.

**Response:**

```json
{
  "status": "ok"
}
```

---

## 🧩 Technology Stack

- **Go 1.22+**
- **Echo v4** — HTTP framework
- **GORM** — ORM for SQLite
- **SQLite** — local database storage

---

## 🧱 Project Structure

```
binary-annotator-pro/
├── main.go
├── config/
│   └── db.go
├── models/
│   ├── binary_file.go
│   └── yaml_config.go
├── handlers/
│   └── handlers.go
├── router/
│   └── router.go
└── go.mod
```

---
