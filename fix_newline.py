import fs
import re

file_path = "src/services/telegramService.ts"

with open(file_path, "r") as f:
    content = f.read()

# Replace the literal \n characters with actual newlines
content = content.replace("});\\n        }\\n        return;\\n      }", "});\n        }\n        return;\n      }")

with open(file_path, "w") as f:
    f.write(content)

print("Fixed newlines")
