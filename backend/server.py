"""Backend flask server. Has 2 endpoints: encoding and segmenting, both handled in different scripts."""
from flask import (
    Flask,
    request,
    make_response,
    jsonify,
    send_file,
    Response,
    render_template,
    send_from_directory,
)
import base64
from io import BytesIO

import os

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()
print(CWD, os.getcwd())

from encode import encode, featurise
from segment import segment, save_labels
from PIL import Image

app = Flask(
    __name__,
)


# these 2 functions from user Niels B on stack overflow: https://stackoverflow.com/questions/25594893/how-to-enable-cors-in-flask
def _build_cors_preflight_response():
    response = make_response()
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "*")
    response.headers.add("Access-Control-Allow-Methods", "*")
    return response


def _corsify_actual_response(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    return response


def _get_image_from_b64(b64_with_prefix: str):
    b64 = b64_with_prefix.split(",")[1]
    imgdata = base64.standard_b64decode(b64)
    image = Image.open(BytesIO(imgdata))
    return image


@app.route("/")
def hello_world():
    return send_from_directory("", "index.html")


@app.route("/featurising", methods=["POST", "GET", "OPTIONS"])
async def featurise_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:
        UID = request.json["id"]
        features = request.json["features"]
        try:
            os.mkdir(f"{CWD}/{UID}")
        except FileExistsError:
            pass
        images = [_get_image_from_b64(i) for i in request.json["images"]]
        success = await featurise(images, UID, selected_features=features)
        with open(f"{CWD}/{UID}/success.txt", "w+") as f:
            f.write("done")
        return _corsify_actual_response(jsonify(success=True))


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
def encode_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        image = _get_image_from_b64(request.json["message"])
        UID = request.json["id"]
        try:
            os.mkdir(f"{CWD}/{UID}")
        except FileExistsError:
            pass
        encoded_bytes = encode(image)
        response = Response(encoded_bytes)
        response.headers.add("Content-Type", "application/octet-stream")
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/segmenting", methods=["POST", "GET", "OPTIONS"])
async def segment_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        images = [_get_image_from_b64(i) for i in request.json["images"]]
        labels_dicts = request.json["labels"]
        UID = request.json["id"]
        try:
            os.mkdir(f"{CWD}/{UID}")
        except FileExistsError:
            pass
        save_mode = request.json["save_mode"]
        large_w, large_h = request.json["large_w"], request.json["large_h"]
        print(request.json["features"])
        segmentation = await segment(
            images, labels_dicts, UID, save_mode, large_w, large_h
        )
        response = Response(segmentation.tobytes())
        response.headers.add("Content-Type", "application/octet-stream")
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/saving", methods=["POST", "GET", "OPTIONS"])
def save_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        UID = request.json["id"]
        response = send_file(
            f"{CWD}/{UID}/seg.tiff", mimetype="image/tiff", download_name="seg.tiff"
        )
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/slabel", methods=["POST", "GET", "OPTIONS"])
def save_labels_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        images = [_get_image_from_b64(i) for i in request.json["images"]]
        labels_dicts = request.json["labels"]
        save_mode = request.json["save_mode"]
        large_w, large_h = request.json["large_w"], request.json["large_h"]
        labels_bytes = save_labels(images, labels_dicts, save_mode, large_w, large_h)
        response = Response(labels_bytes)
        response.headers.add("Content-Type", "application/octet-stream")
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/classifier", methods=["POST", "GET", "OPTIONS"])
def classifier_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        UID = request.json["id"]
        response = send_file(
            f"{CWD}/{UID}/classifier.pkl",
            mimetype="application/octet-stream",
            download_name="classifier.pkl",
        )
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


if __name__ == "__main__":
    app.run()
