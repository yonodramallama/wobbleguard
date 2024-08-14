import os
import datetime

def aggregate_js_files(directory):
    # Get the current timestamp for the output file
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    output_filename = f'source-{timestamp}.txt'

    # Open the output file in write mode with UTF-8 encoding
    with open(output_filename, 'w', encoding='utf-8') as outfile:
        outfile.write("JavaScript Project Source Code\n")
        outfile.write("=" * 30 + "\n\n")
        
        # List all files in the root directory
        for file in os.listdir(directory):
            if file.endswith(".js"):
                filepath = os.path.join(directory, file)
                outfile.write(f"File: {filepath}\n")
                outfile.write("=" * 30 + "\n")
                
                # Read the content of each .js file with UTF-8 encoding and write to the output file
                with open(filepath, 'r', encoding='utf-8') as infile:
                    content = infile.read()
                    outfile.write(content + "\n\n")
                
                outfile.write("=" * 30 + "\n\n")
    
    print(f"Aggregated source code has been saved to {output_filename}")

# Run the script in the current directory
if __name__ == "__main__":
    aggregate_js_files('.')
