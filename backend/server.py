"""Backend flask server. Has 2 endpoints: encoding and segmenting, both handled in different scripts."""
from flask import Flask, request, make_response, jsonify, send_file
import base64
from io import BytesIO
from PIL import Image
import numpy as np

from encode import encode
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


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
def encode_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        image = _get_image_from_b64(request.json["message"])
        image.save("image.jpeg")
        encoded = encode(image)
        response = send_file("encoding.npy")
        # order = {"message": b64_image}
        return _corsify_actual_response(response)
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


@app.route("/segmenting", methods=["POST", "GET", "OPTIONS"])
def segment_respond():
    if "OPTIONS" in request.method:  # CORS preflight
        return _build_cors_preflight_response()
    elif "POST" in request.method:  # The actual request following the preflight
        image = _get_image_from_b64(request.json["image"])
        labels_dict = request.json["labels"]
        segmentation = segment(image, labels_dict)
        return _corsify_actual_response(jsonify({"message": f"{np.sum(segmentation)}"}))
    else:
        raise RuntimeError("Wrong HTTP method {}".format(request.method))


def _get_image_from_b64(b64_with_prefix: str):
    b64 = b64_with_prefix.split(",")[1]
    imgdata = base64.standard_b64decode(b64)
    image = Image.open(BytesIO(imgdata))
    return image
