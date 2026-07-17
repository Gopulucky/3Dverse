from sentence_transformers import SentenceTransformer

# Load the model lazily to avoid blocking startup if not needed immediately
_model = None

def get_embedding(text: str) -> list[float]:
    """
    Generates a 384-dimensional embedding for the given text using all-MiniLM-L6-v2.
    """
    global _model
    if _model is None:
        _model = SentenceTransformer('all-MiniLM-L6-v2')
    
    # Generate embedding and convert to standard python float list
    embedding = _model.encode(text)
    return embedding.tolist()
