"""Backend flask server. Has 2 endpoints: encoding and segmenting, both handled in different scripts."""
from flask import Flask, request, make_response, jsonify, send_file, Response
import base64
from io import BytesIO
from PIL import Image
from tifffile import imread
import os

from encode import encode, featurise
from segment import segment

app = Flask(__name__)


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


@app.route("/featurising", methods=["POST", "GET", "OPTIONS"])
def featurise_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:
        UID = request.json["id"]
        try:
            os.mkdir(UID)
        except FileExistsError:
            pass
        images = [_get_image_from_b64(i) for i in request.json["images"]]
        featurise(images, UID)
        with open(f"{UID}/success.txt", "w+") as f:
            f.write("done")
        return _corsify_actual_response(jsonify(success=True))


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
def encode_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        image = _get_image_from_b64(request.json["message"])
        image_id = int(request.json["img_idx"])
        UID = request.json["id"]
        encoded = encode(image, UID, image_id)
        response = send_file(f"{UID}/encoding_{image_id}.npy")
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/segmenting", methods=["POST", "GET", "OPTIONS"])
def segment_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        images = [_get_image_from_b64(i) for i in request.json["images"]]
        labels_dicts = request.json["labels"]
        UID = request.json["id"]
        save_mode = request.json["save_mode"]
        large_w, large_h = request.json["large_w"], request.json["large_h"]
        print(save_mode, large_w, large_h)
        segmentation = segment(images, labels_dicts, UID, save_mode, large_w, large_h)
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
            f"{UID}/seg.tiff", mimetype="image/tiff", download_name="seg.tiff"
        )
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
            f"{UID}/classifier.pkl",
            mimetype="application/octet-stream",
            download_name="classifier.pkl",
        )
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))
