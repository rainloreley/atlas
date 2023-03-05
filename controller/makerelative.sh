# USE OF THIS FILE
# =================
#
# When Next.js generates a static page, it's intended for use on a domain.
# That's why all imports for CSS and JS are absolute paths.
# If you open the .html file itself, this won't work because it'll start looking for these files at '/'
# This script changes all absolute paths to relative paths by converting '="/' to '="./' for href and src parameters

echo "Converting absolute paths to relative..."

cd out/
sed -i -e 's/href=\"\//href=\".\//g' index.html
sed -i -e 's/src=\"\//src=\".\//g' index.html