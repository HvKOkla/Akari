use sha2::{Sha256, Digest};


pub fn hash_script(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let result = hasher.finalize();
    
    
    format!("{:x}", result)
}

pub fn verify_script(input: &str, expected_hash: &str) -> bool {
    hash_script(input) == expected_hash
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_is_valid() {
        let script = "say('Hello Akari')";
        let hash = hash_script(script);
        
        
        assert_eq!(hash.len(), 64);
        
        
        assert!(verify_script(script, &hash));
        
     
        assert!(!verify_script("say('Hacked')", &hash));
    }
}