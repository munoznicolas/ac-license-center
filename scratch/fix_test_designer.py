with open('tests/unit/test_designer_server.py', 'r', encoding='utf-8') as f:
    c = f.read()

target = 'self.assertIn("const refTestsPromise = loadReferenceTests();", editor_js)'
replacement = 'self.assertIn("loadReferenceTests()", editor_js)'

if target in c:
    c = c.replace(target, replacement)
    with open('tests/unit/test_designer_server.py', 'w', encoding='utf-8', newline='') as f:
        f.write(c)
    print("Replaced successfully")
else:
    print("Target not found")
