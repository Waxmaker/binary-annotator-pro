# 🗜️ Binary Compression Detection & Analysis Guide

## 📋 Vue d'ensemble

Ce document liste toutes les méthodes de compression binaire avec un système de checklist pour détecter et décompresser automatiquement les données.

**Objectif** : Créer un outil Python backend qui teste chaque compression et génère automatiquement les fichiers décompressés.

**Exemple** : `file.DAT` → test LZW OK → créer `file.DAT.LZW` (décompressé)

---

## 🎯 Priorités d'analyse

### ⭐ Top Priority (80% des cas ECG/Medical)

- [ ] **RLE** (Run-Length Encoding)
- [ ] **Delta Encoding** (DPCM)
- [ ] **Huffman** (standard ou custom)
- [ ] **LZSS** / **LZ77**
- [ ] **LZW**
- [ ] **Deflate** (zlib/gzip)
- [ ] **Rice/Golomb** (signaux compressés)
- [ ] **DPCM** (ECG spécifique)

### 🏥 ECG & Signaux Médicaux Spécifiques

- [ ] **Delta entre samples** (différences successives)
- [ ] **Dérivations compressées** (V1-V12 dérivées de I, II, III)
- [ ] **VLQ** (Variable Length Quantity)
- [ ] **Huffman custom** (table dans header)
- [ ] **Wavelet simple** (CDF 5/3 ou Haar)
- [ ] **SPIHT** (Set Partitioning in Hierarchical Trees)

---

## 📚 Classification Complète des Compressions

### 1️⃣ Compressions sans perte (Lossless)

#### A. Substitution & Dictionnaire

##### ✅ LZ77 / LZSS (Très fréquent)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Patterns: Backreferences (offset, length)
  - Entropy: Moyenne à élevée
  - Caractéristique: Pointeurs vers données précédentes
Libraries:
  - Python: lz77, pylzss
  - Go: github.com/klauspost/compress
Test:
  - Rechercher des patterns (offset, length) répétés
  - Vérifier la présence de backreferences
Signature: Pas de magic number fixe
```

##### ✅ LZW (Très fréquent - GIF, TIFF)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Patterns: Codes de taille croissante (9-12 bits)
  - Entropie: Élevée mais structurée
  - Caractéristique: Dictionnaire dynamique
Libraries:
  - Python: lzw, lzw3
  - Go: compress/lzw
Test:
  - Commencer décompression avec dictionnaire 256 entrées
  - Détecter codes 9-12 bits
  - Vérifier table augmentation
Magic: GIF (47 49 46), TIFF (4D 4D, 49 49)
```

##### ⬜ LZ4 (Ultra-rapide)
```yaml
Priorité: ⬜
Détection:
  - Magic: 0x04 0x22 0x4D 0x18
  - Structure: Frame format bien défini
Libraries:
  - Python: lz4
  - Go: github.com/pierrec/lz4
Magic: 04 22 4D 18
```

##### ⬜ LZMA / LZMA2 (7-Zip, XZ)
```yaml
Priorité: ⬜
Détection:
  - Magic XZ: 0xFD 0x37 0x7A 0x58 0x5A 0x00
  - Magic 7z: 0x37 0x7A 0xBC 0xAF 0x27 0x1C
  - Très haute compression
Libraries:
  - Python: lzma (built-in), pylzma
  - Go: github.com/ulikunitz/xz
Magic:
  - XZ: FD 37 7A 58 5A 00
  - 7z: 37 7A BC AF 27 1C
```

##### ⬜ Snappy (Google)
```yaml
Priorité: ⬜
Détection:
  - Pas de magic number standard
  - Format: Length prefixed chunks
Libraries:
  - Python: python-snappy
  - Go: github.com/golang/snappy
```

#### B. Encodage Statistique

##### ✅ Huffman (Très fréquent)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Table Huffman en header (256 entrées)
  - Codes de longueur variable
  - Entropie proche de l'optimale
Libraries:
  - Python: huffman, dahuffman
  - Custom: Implémenter décodeur
Test:
  - Extraire table du header
  - Vérifier cohérence des codes
  - Décoder stream de bits
Types:
  - Huffman standard (table dans header)
  - Huffman adaptatif
  - Huffman canonique
```

##### ✅ Arithmetic Coding
```yaml
Priorité: ⬜
Détection:
  - Entropie quasi-optimale
  - Pas de boundaries de bytes
  - Plus complexe que Huffman
Libraries:
  - Python: arithmetic-compressor
  - Custom implementation
```

##### ⬜ ANS (Asymmetric Numeral Systems)
```yaml
Priorité: ⬜
Détection:
  - État moderne de l'art
  - Utilisé dans Zstd, JPEG XL
Libraries:
  - Python: Rare, voir Zstd
  - Go: Intégré dans Zstd
```

#### C. Transformation + Compression

##### ✅ Deflate (zlib, gzip, PNG)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Magic gzip: 0x1F 0x8B
  - Magic zlib: 0x78 (puis 0x01, 0x5E, 0x9C, 0xDA)
  - Combinaison LZ77 + Huffman
Libraries:
  - Python: zlib, gzip (built-in)
  - Go: compress/gzip, compress/zlib
Test:
  - Essayer zlib.decompress()
  - Essayer gzip.decompress()
Magic:
  - gzip: 1F 8B
  - zlib: 78 01, 78 5E, 78 9C, 78 DA
```

##### ⬜ Bzip2
```yaml
Priorité: ⬜
Détection:
  - Magic: 0x42 0x5A 0x68 ('BZh')
  - Burrows-Wheeler Transform + RLE + Huffman
Libraries:
  - Python: bz2 (built-in)
  - Go: compress/bzip2
Magic: 42 5A 68
```

##### ⬜ Zstd (Facebook)
```yaml
Priorité: ⬜
Détection:
  - Magic: 0x28 0xB5 0x2F 0xFD
  - État de l'art moderne
Libraries:
  - Python: zstandard
  - Go: github.com/klauspost/compress/zstd
Magic: 28 B5 2F FD
```

#### D. Codage par Transformée

##### ⬜ BWT (Burrows-Wheeler Transform)
```yaml
Priorité: ⬜
Détection:
  - Nécessite index de rotation
  - Utilisé dans bzip2
Libraries:
  - Custom implementation
```

##### ⬜ MTF (Move-to-Front)
```yaml
Priorité: ⬜
Détection:
  - Patterns de petits nombres répétés
Libraries:
  - Custom implementation
```

### 2️⃣ Compressions Spécifiques Signaux

#### A. Compression Temporelle

##### ✅ RLE (Run-Length Encoding)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Séquences répétées visibles
  - Patterns: (count, value) ou (value, count)
  - Entropie basse avec répétitions
Libraries:
  - Custom implementation (simple)
Test:
  - Format 1: [count][value]
  - Format 2: [value][count]
  - Format 3: Flag byte + count + value
Variantes:
  - RLE simple
  - RLE avec escape character
  - PackBits (Adobe)
```

##### ✅ Delta Encoding (DPCM)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Valeurs proches de zéro
  - Distribution centrée
  - Meilleure compression avec Huffman après
Libraries:
  - Custom implementation
Test:
  - Calculer différences: delta[i] = data[i] - data[i-1]
  - Vérifier si entropie diminue
  - Tester ordre 1, 2, 3
Types:
  - Delta ordre 1: diff = current - previous
  - Delta ordre 2: diff = current - 2*prev + prev2
  - Delta adaptatif
```

##### ✅ DPCM (Differential Pulse Code Modulation)
```yaml
Priorité: ⭐⭐⭐
Détection:
  - Similar à Delta mais avec prédiction
  - Quantification des différences
  - Très utilisé en audio/ECG
Libraries:
  - Custom implementation
Test:
  - Prédire sample suivant
  - Coder différence prédiction/réel
  - Tester différents prédicteurs
```

##### ✅ Rice/Golomb Coding
```yaml
Priorité: ⭐⭐
Détection:
  - Unary prefix + binary suffix
  - Optimal pour distributions géométriques
  - Utilisé en audio lossless (FLAC)
Libraries:
  - Custom implementation
  - Python: Voir implementation FLAC
Test:
  - Détecter unary codes (succession de 1s + 0)
  - Parameter M adaptatif
```

#### B. Compression Fréquentielle

##### ✅ Wavelet (Simple)
```yaml
Priorité: ⭐⭐
Détection:
  - Coefficients haute/basse fréquence séparés
  - Patterns multi-résolution
Libraries:
  - Python: PyWavelets
  - Types: Haar, CDF 5/3, Daubechies
Test:
  - Décomposition multi-niveau
  - Coefficients quantifiés
  - Seuillage
```

##### ⬜ DCT (Discrete Cosine Transform)
```yaml
Priorité: ⬜ (plutôt images)
Détection:
  - Blocs 8x8 pour images
  - Coefficients DC/AC
Libraries:
  - Python: scipy.fft.dct
```

##### ⬜ FFT-based
```yaml
Priorité: ⬜
Détection:
  - Coefficients fréquentiels
  - Phase/Magnitude séparées
Libraries:
  - Python: numpy.fft, scipy.fft
```

#### C. Compression ECG Spécifique

##### ✅ Lead Compression (Dérivations)
```yaml
Priorité: ⭐⭐⭐
Description: |
  Les dérivations V1-V12 sont calculées à partir de I, II, III
  VR = -(I + II)/2
  VL = I - II/2
  VF = II - I/2
Détection:
  - Seulement 3 leads stockés complets
  - 9 autres leads absents ou flag de dérivation
Test:
  - Vérifier si 3 leads principaux
  - Reconstruire les 9 autres
  - Valider avec patterns ECG
```

##### ✅ SPIHT (Set Partitioning Hierarchical Trees)
```yaml
Priorité: ⭐
Description: |
  Compression wavelet progressive
  Utilisé en ECG haute qualité
Détection:
  - Structure hiérarchique d'arbres
  - Bits de signification progressive
Libraries:
  - Custom implementation (complexe)
```

##### ✅ VLQ (Variable Length Quantity)
```yaml
Priorité: ⭐⭐
Détection:
  - MSB = 1 pour continuation
  - MSB = 0 pour dernier byte
  - Utilisé en MIDI, DICOM
Test:
  - Lire bytes tant que MSB=1
  - Combiner 7 bits inférieurs
Example:
  - 0x81 0x00 = 128
  - 0xFF 0x7F = 16383
```

### 3️⃣ Compressions avec Perte (Lossy)

#### ⬜ JPEG (DCT + Quantification)
```yaml
Priorité: ⬜
Magic: FF D8 FF
```

#### ⬜ JPEG 2000 (Wavelet)
```yaml
Priorité: ⬜
Magic: 00 00 00 0C 6A 50 20 20
```

#### ⬜ MP3 / AAC (Audio)
```yaml
Priorité: ⬜
Magic MP3: FF FB, FF F3, FF F2
```

### 4️⃣ Compressions Spécialisées

#### ⬜ PPM (Prediction by Partial Matching)
```yaml
Priorité: ⬜
Détection: Contexts de taille variable
```

#### ⬜ PAQ (Context Mixing)
```yaml
Priorité: ⬜
Détection: Multiple predictors combinés
```

#### ⬜ LZHAM
```yaml
Priorité: ⬜
Détection: Magic bytes spécifiques
```

---

## 🔬 Méthode de Détection Automatique

### Étape 1: Tests Rapides (Magic Bytes)

```python
MAGIC_SIGNATURES = {
    b'\x1F\x8B': 'gzip',
    b'\x78\x01': 'zlib',
    b'\x78\x5E': 'zlib',
    b'\x78\x9C': 'zlib',
    b'\x78\xDA': 'zlib',
    b'BZh': 'bzip2',
    b'\x28\xB5\x2F\xFD': 'zstd',
    b'\x04\x22\x4D\x18': 'lz4',
    b'\xFD\x37\x7A\x58\x5A\x00': 'xz',
    b'GIF': 'lzw-gif',
    b'\x4D\x4D': 'tiff-lzw',
    b'\x49\x49': 'tiff-lzw',
    b'\xFF\xD8\xFF': 'jpeg',
}
```

### Étape 2: Analyse Statistique

```python
def analyze_entropy(data):
    """Calculer l'entropie de Shannon"""
    # Entropy proche de 8.0 = très compressé/random
    # Entropy basse = patterns répétitifs

def detect_patterns(data):
    """Détecter patterns de compression"""
    # RLE: répétitions
    # Delta: petites valeurs
    # Huffman: table en header
    # LZ: backreferences
```

### Étape 3: Tests de Décompression

```python
def try_decompress(data, method):
    """Tenter décompression avec retry et variants"""
    try:
        result = decompress_method(data)
        if validate_result(result):
            return result, True
    except:
        return None, False
```

---

## 🛠️ Structure de l'Outil Python

### Architecture Proposée

```
backend/
  compression_detector/
    __init__.py
    detector.py          # Orchestrateur principal
    analyzers/
      __init__.py
      magic_bytes.py     # Détection par signatures
      statistical.py     # Analyse entropie/patterns
      compression/
        lzw.py
        lzss.py
        huffman.py
        rle.py
        delta.py
        deflate.py
        rice.py
        wavelet.py
        ecg_specific.py  # Compressions ECG
    decompressors/
      __init__.py
      # Un fichier par méthode
    utils/
      validation.py      # Valider résultats
      entropy.py         # Calculs statistiques
```

### Workflow

```python
# 1. Charger fichier
data = load_binary_file("file.DAT")

# 2. Détection rapide
compression_type = detect_compression_type(data)

# 3. Tests prioritaires
for method in PRIORITY_METHODS:
    result, success = try_decompress(data, method)
    if success:
        save_decompressed(f"file.DAT.{method.upper()}", result)
        log_success(method, stats)

# 4. Tests exhaustifs si échec
if not found:
    for method in ALL_METHODS:
        # ... try all
```

---

## 📊 Indicateurs de Succès

### Validation de Décompression

```yaml
Critères:
  ✓ Taille décompressée > taille compressée (ratio > 1.0)
  ✓ Pas d'erreurs de décompression
  ✓ Entropie diminue après décompression
  ✓ Patterns reconnaissables dans output
  ✓ Validation checksums si présents

ECG Specific:
  ✓ Valeurs dans range physiologique (-5mV à +5mV)
  ✓ Fréquence échantillonnage cohérente (125-1000 Hz)
  ✓ Patterns QRS détectables
  ✓ 12 leads cohérents entre eux
```

---

## 🎯 Checklist d'Implémentation

### Phase 1: Core (Top Priority) ⭐⭐⭐
- [ ] RLE detector + decompressor
- [ ] Delta encoding (ordre 1, 2, 3)
- [ ] Huffman (standard + custom table)
- [ ] LZSS/LZ77
- [ ] LZW
- [ ] Deflate (zlib/gzip)
- [ ] Rice/Golomb
- [ ] DPCM

### Phase 2: ECG Specific ⭐⭐
- [ ] Lead derivation (3→12 leads)
- [ ] VLQ decoder
- [ ] Wavelet simple (Haar, CDF 5/3)
- [ ] ECG validation (physiological ranges)

### Phase 3: Extended ⭐
- [ ] LZMA/XZ
- [ ] Bzip2
- [ ] LZ4
- [ ] Zstd
- [ ] Arithmetic coding
- [ ] SPIHT

### Phase 4: Advanced
- [ ] ANS
- [ ] PAQ
- [ ] Custom hybrid methods

---

## 📖 Ressources & Librairies

### Python Libraries
```bash
# Core compression
pip install lz4 lzma zstandard python-snappy
pip install brotli

# Signal processing
pip install numpy scipy PyWavelets

# ECG specific
pip install wfdb biosppy

# Custom implementations
# Huffman, RLE, Delta, Rice: custom code
```

### Go Libraries (Backend Integration)
```bash
go get github.com/klauspost/compress
go get github.com/pierrec/lz4
go get github.com/ulikunitz/xz
go get github.com/golang/snappy
```

---

## 🔄 Output Format

### Fichiers Générés

```
Original: file.DAT

Tests réussis:
  ✓ file.DAT.RLE         (ratio: 2.3x, confidence: 95%)
  ✓ file.DAT.DELTA       (ratio: 1.8x, confidence: 87%)
  ✓ file.DAT.HUFFMAN     (ratio: 3.1x, confidence: 99%)
  ✓ file.DAT.DEFLATE     (ratio: 2.7x, confidence: 92%)

Tests échoués:
  ✗ LZW (error: invalid dictionary)
  ✗ LZMA (error: corrupted header)

Meilleur candidat: HUFFMAN (3.1x, 99%)
```

### Metadata JSON

```json
{
  "original_file": "file.DAT",
  "original_size": 1048576,
  "timestamp": "2025-11-20T16:00:00Z",
  "successful_decompressions": [
    {
      "method": "huffman",
      "output_file": "file.DAT.HUFFMAN",
      "decompressed_size": 3248128,
      "compression_ratio": 3.1,
      "confidence": 0.99,
      "validation": {
        "entropy_original": 7.2,
        "entropy_decompressed": 4.8,
        "checksum_valid": true
      }
    }
  ],
  "failed_methods": ["lzw", "lzma"],
  "best_candidate": "huffman"
}
```

---

## 🚀 Prochaines Étapes

1. **Créer le squelette Python** dans `backend/compression_detector/`
2. **Implémenter détection magic bytes** (rapide, 1 heure)
3. **Implémenter RLE, Delta, Huffman** (priorité max, 1 jour)
4. **Ajouter tests exhaustifs** pour chaque méthode
5. **Intégrer dans backend Go** via subprocess ou API
6. **UI pour visualiser résultats** dans frontend

---

## 💡 Notes Importantes

- **Commencer simple**: RLE et Delta sont faciles et très fréquents
- **Tests incrémentaux**: Tester d'abord sur fichiers connus
- **Validation stricte**: Beaucoup de faux positifs possibles
- **Performance**: Certains tests peuvent être lents (LZMA, wavelet)
- **Parallélisation**: Tests indépendants peuvent être parallélisés
- **Cache résultats**: Éviter de retester les mêmes fichiers

---

*Document créé pour Binary Annotator Pro - ECG Analysis Workbench*
*Version 1.0 - 2025-11-20*
