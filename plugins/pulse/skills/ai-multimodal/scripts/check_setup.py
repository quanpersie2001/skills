#!/usr/bin/env python3
"""
Validate ai-multimodal skill setup and configuration.

Checks:
- API key presence and format
- Python dependencies
- Centralized resolver availability
- Directory structure
"""

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

# Fix Windows console encoding for Unicode output (emojis, arrows)
if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except AttributeError:
        pass  # Python < 3.7

# Color codes for terminal output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
BLUE = '\033[94m'
RESET = '\033[0m'
BOLD = '\033[1m'


def print_header(text):
    """Print section header."""
    print(f"\n{BOLD}{BLUE}{'='*60}{RESET}")
    print(f"{BOLD}{BLUE}{text}{RESET}")
    print(f"{BOLD}{BLUE}{'='*60}{RESET}\n")


def print_success(text):
    """Print success message."""
    print(f"{GREEN}✓ {text}{RESET}")


def print_warning(text):
    """Print warning message."""
    print(f"{YELLOW}⚠ {text}{RESET}")


def print_error(text):
    """Print error message."""
    print(f"{RED}✗ {text}{RESET}")


def print_info(text):
    """Print info message."""
    print(f"{BLUE}ℹ {text}{RESET}")


def load_local_env_files():
    """Load local .env files from the skill directory upward."""
    if load_dotenv is None:
        return

    script_dir = Path(__file__).resolve().parent
    skill_dir = script_dir.parent
    candidates = []

    for path in [
        skill_dir.parent.parent,
        skill_dir.parent,
        skill_dir,
        Path.cwd(),
    ]:
        if path not in candidates:
            candidates.append(path)

    for base_dir in candidates:
        env_file = base_dir / '.env'
        if env_file.exists():
            load_dotenv(env_file, override=True)


def check_dependencies():
    """Check if required Python packages are installed."""
    print_header("Checking Python Dependencies")

    dependencies = {
        'google.genai': 'google-genai',
        'dotenv': 'python-dotenv',
        'PIL': 'pillow'
    }

    missing = []

    for module_name, package_name in dependencies.items():
        try:
            __import__(module_name)
            print_success(f"{package_name} is installed")
        except ImportError:
            print_error(f"{package_name} is NOT installed")
            missing.append(package_name)

    if missing:
        print_error("\nMissing dependencies detected!")
        print_info(f"Install with: pip install {' '.join(missing)}")
        return False

    return True


def check_optional_tools():
    """Check optional tools used by specific scripts."""
    print_header("Checking Optional Tools")

    ffmpeg_on_path = any(
        (Path(path) / 'ffmpeg').exists() or (Path(path) / 'ffmpeg.exe').exists()
        for path in os.environ.get('PATH', '').split(os.pathsep)
        if path
    )

    if ffmpeg_on_path:
        print_success("ffmpeg is available (needed for media optimization workflows)")
    else:
        print_warning("ffmpeg not found on PATH")
        print_info("Install ffmpeg if you plan to use media_optimizer.py or long media chunking")


def check_centralized_resolver():
    """Check if centralized resolver is available."""
    print_header("Checking Centralized Resolver")

    resolver_path = Path.home() / '.claude' / 'scripts' / 'resolve_env.py'

    if resolver_path.exists():
        print_success(f"Centralized resolver found: {resolver_path}")

        # Try to import it
        sys.path.insert(0, str(resolver_path.parent))
        try:
            from resolve_env import resolve_env
            print_success("Centralized resolver can be imported")
            return True
        except ImportError as e:
            print_error(f"Centralized resolver exists but cannot be imported: {e}")
            return False
    else:
        print_warning(f"Centralized resolver not found: {resolver_path}")
        print_info("Skill will use self-contained local env resolution instead")
        return True  # Not critical, fallback works


def find_api_key():
    """Find and validate API key using centralized resolver."""
    print_header("Checking API Key Configuration")

    # Try to use centralized resolver
    sys.path.insert(0, str(Path.home() / '.claude' / 'scripts'))
    try:
        from resolve_env import resolve_env

        print_info("Using centralized resolver...")
        api_key = resolve_env('GEMINI_API_KEY', skill='ai-multimodal')

        if api_key:
            print_success("API key found via centralized resolver")
            print_info(f"Key preview: {api_key[:20]}...{api_key[-4:]}")

            # Show hierarchy
            print_info("\nTo see where the key was found, run:")
            print_info("python ~/.claude/scripts/resolve_env.py GEMINI_API_KEY --skill ai-multimodal --verbose")

            return api_key
        else:
            print_error("API key not found in any location")
            return None

    except ImportError:
        print_warning("Centralized resolver not available, using local fallback")

        load_local_env_files()

        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            print_success("API key found via local environment resolution")
            print_info(f"Key preview: {api_key[:20]}...{api_key[-4:]}")
            return api_key
        else:
            print_error("API key not found")
            return None


def validate_api_key_format(api_key):
    """Basic validation of API key format."""
    if not api_key:
        return False

    # Google AI Studio keys typically start with 'AIza'
    if api_key.startswith('AIza'):
        print_success("API key format looks valid (Google AI Studio)")
        return True
    elif len(api_key) > 20:
        print_warning("API key format not recognized (may be Vertex AI or custom)")
        return True
    else:
        print_error("API key format looks invalid (too short)")
        return False


def test_api_connection(api_key):
    """Test API connection with a simple request."""
    print_header("Testing API Connection")

    try:
        from google import genai

        print_info("Initializing Gemini client...")
        client = genai.Client(api_key=api_key)

        print_info("Fetching available models...")
        # List models to verify API key works
        models = list(client.models.list())

        print_success(f"API connection successful! Found {len(models)} available models")

        # Show some available models
        print_info("\nSample available models:")
        for model in models[:5]:
            print(f"  - {model.name}")

        return True

    except ImportError:
        print_error("google-genai package not installed")
        return False
    except Exception as e:
        print_error(f"API connection failed: {str(e)}")
        return False


def check_directory_structure():
    """Verify skill directory structure."""
    print_header("Checking Directory Structure")

    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent

    required_files = [
        ('SKILL.md', skill_dir / 'SKILL.md'),
        ('.env.example', skill_dir / '.env.example'),
        ('gemini_batch_process.py', script_dir / 'gemini_batch_process.py'),
    ]

    all_exist = True

    for name, path in required_files:
        if path.exists():
            print_success(f"{name} exists")
        else:
            print_error(f"{name} NOT found at {path}")
            all_exist = False

    return all_exist


def provide_setup_instructions():
    """Provide setup instructions if configuration is incomplete."""
    print_header("Setup Instructions")

    print_info("To configure the ai-multimodal skill:")
    print("\n1. Get a Gemini API key:")
    print("   → Visit: https://aistudio.google.com/apikey")

    script_dir = Path(__file__).parent
    skill_dir = script_dir.parent

    print("\n2. Configure the API key (choose one method):")

    print(f"\n   Option A: Skill-specific config (recommended for this standalone copy)")
    print(f"   $ cd {skill_dir}")
    print(f"   $ cp .env.example .env")
    print(f"   $ # Edit .env and add your API key")

    print(f"\n   Option B: Runtime environment (temporary)")
    print(f"   $ export GEMINI_API_KEY='your-api-key-here'")

    print(f"\n   Option C: Shared repo config")
    print(f"   $ echo 'GEMINI_API_KEY=your-api-key-here' >> {skill_dir.parent / '.env'}")

    print("\n3. Verify setup:")
    print(f"   $ python {Path(__file__)}")

    print("\n4. Debug if needed:")
    print("   - Confirm the key is visible in the current shell or local .env")
    print("   - Re-run this checker with the same cwd you plan to use for the scripts")


def main():
    """Run all setup checks."""
    print(f"\n{BOLD}AI Multimodal Skill - Setup Checker{RESET}")

    all_passed = True

    # Check directory structure
    if not check_directory_structure():
        all_passed = False

    # Check centralized resolver
    check_centralized_resolver()

    # Check dependencies
    if not check_dependencies():
        all_passed = False
        provide_setup_instructions()
        sys.exit(1)

    check_optional_tools()

    # Check API key
    api_key = find_api_key()

    if not api_key:
        print_error("\n❌ GEMINI_API_KEY not found in any location")
        all_passed = False
        provide_setup_instructions()
        sys.exit(1)

    # Validate API key format
    if not validate_api_key_format(api_key):
        all_passed = False

    # Test API connection
    if not test_api_connection(api_key):
        all_passed = False

    # Final summary
    print_header("Setup Summary")

    if all_passed:
        print_success("✅ All checks passed! The ai-multimodal skill is ready to use.")
        print_info("\nNext steps:")
        print("  • Read SKILL.md for usage examples")
        print("  • Try: python scripts/gemini_batch_process.py --help")
        print("  • For Markdown conversion: python scripts/document_converter.py --help")
        print("  • For media preflight: python scripts/media_optimizer.py --help")
        print("\nImage generation models:")
        print("  • gemini-2.5-flash-image    - Nano Banana Flash (DEFAULT - fast)")
        print("  • imagen-4.0-generate-001   - Imagen 4 (alternative - production)")
        print("  • gemini-3-pro-image-preview - Nano Banana Pro (4K text, reasoning)")
        print("\nExample (uses default model):")
        print("  python scripts/gemini_batch_process.py --task generate \\")
        print("    --prompt 'A sunset over mountains' --aspect-ratio 16:9 --size 2K")
    else:
        print_error("❌ Some checks failed. Please fix the issues above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
