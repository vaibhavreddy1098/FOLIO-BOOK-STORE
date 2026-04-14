from fastapi import Request, HTTPException, status
from authentication.jwt import verify_token


def get_current_user(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid"
        )
    return payload


def student_only(request: Request):
    user = get_current_user(request)
    if user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students only"
        )
    return user




def get_current_user(request: Request) -> dict:
    auth_header = request.headers.get("Authorization")

    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header"
        )

    token = auth_header.split(" ", 1)[1]
    payload = verify_token(token)

    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired or invalid"
        )

    return payload


def student_only(request: Request) -> dict:
    user = get_current_user(request)

    if user.get("role") != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Students only"
        )

    return user


def admin_only(request: Request) -> dict:
    user = get_current_user(request)

    if user.get("role") not in ("admin", "super_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )

    return user

def support_only(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = auth_header.split(" ")[1]
    user_payload = verify_token(token)
    
    # Check if the role is support
    if user_payload.get("role") != "support":
        raise HTTPException(status_code=403, detail="Support access only.")
        
    return user_payload

def super_admin_only(request: Request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = auth_header.split(" ")[1]
    
    # Get the payload from the token
    user_payload = verify_token(token)
    
    # SAFETY CHECK: Make sure verify_token didn't fail or return None
    if not user_payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    
    # Strictly enforce super_admin role
    if user_payload.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access only.")
        
    return user_payload
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    
    token = auth_header.split(" ")[1]
    user_payload = verify_token(token)
    
    # Strictly enforce super_admin role
    if user_payload.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin access only.")
        
    return user_payload