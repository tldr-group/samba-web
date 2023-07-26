"""Backend flask server. Has 2 endpoints: encoding and segmenting, both handled in different scripts."""
from flask import (
    Flask,
    request,
    make_response,
    jsonify,
    send_file,
    Response,
    send_from_directory,
)
import base64
from io import BytesIO
from PIL import Image
from typing import Callable
from azure.storage.blob import BlobServiceClient
import dotenv
import os

try:
    CWD = os.environ["APP_PATH"]
except KeyError:
    CWD = os.getcwd()
print(CWD, os.getcwd())

from encode import encode, featurise
from segment import segment, save_labels, load_classifier_from_http, apply
from file_handling import delete_old_folders, delete_all_features, delete_feature_file


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


async def generic_response(request, fn: Callable):
    if "OPTIONS" in request.method:
        return _build_cors_preflight_response()
    elif "POST" in request.method:
        try:
            response = await fn(request)
            return _corsify_actual_response(response)
        except Exception as e:
            response = Response(f"{{'msg': '{e}' }}", 400, mimetype="application/json")
            return _corsify_actual_response(response)
    else:
        response = jsonify(success=False)
        return _corsify_actual_response(response)


@app.route("/")
def hello_world():
    return send_from_directory("", "index.html")


# ================================= INIT =================================
async def init_fn(request) -> Response:
    UID = request.json["id"]
    try:
        os.mkdir(f"{CWD}/{UID}")
    except FileExistsError:
        pass
    delete_old_folders(UID)
    return jsonify(success=True)


@app.route("/init", methods=["POST", "GET", "OPTIONS"])
async def init_app():
    response = await generic_response(request, init_fn)
    return response


# ================================= FEATURISE =================================
async def featurise_fn(request) -> Response:
    UID = request.json["id"]
    features = request.json["features"]
    images = [_get_image_from_b64(i) for i in request.json["images"]]
    offset = request.json["offset"]
    success = await featurise(images, UID, selected_features=features, offset=offset)
    return jsonify(success=True)


@app.route("/featurising", methods=["POST", "GET", "OPTIONS"])
async def featurise_respond():
    response = await generic_response(request, featurise_fn)
    return response


async def delete_fn(request) -> Response:
    UID = request.json["id"]
    img_idx = request.json["idx"]
    if img_idx == -1:
        success = delete_all_features(f"{CWD}/{UID}")
    else:
        success = delete_feature_file(f"{CWD}/{UID}", img_idx)
    return jsonify(success=True)


@app.route("/delete", methods=["POST", "GET", "OPTIONS"])
async def delete_respond():
    response = await generic_response(request, delete_fn)
    return response


# ================================= ENCODE =================================
async def encode_fn(request) -> Response:
    image = _get_image_from_b64(request.json["message"])
    encoded_bytes = encode(image)
    response = Response(encoded_bytes)
    response.headers.add("Content-Type", "application/octet-stream")
    return response


@app.route("/encoding", methods=["POST", "GET", "OPTIONS"])
async def encode_respond():
    response = await generic_response(request, encode_fn)
    return response


# ================================= SEGMENT & APPLY =================================
async def segment_fn(request) -> Response:
    images = [_get_image_from_b64(i) for i in request.json["images"]]
    UID = request.json["id"]
    save_mode = request.json["save_mode"]
    large_w, large_h = request.json["large_w"], request.json["large_h"]
    segment_type = request.json["type"]
    if segment_type == "segment":
        labels_dicts = request.json["labels"]
        n_points, train_all = request.json["n_points"], request.json["train_all"]
        segmentation = await segment(
            images,
            labels_dicts,
            UID,
            save_mode,
            large_w,
            large_h,
            n_points,
            train_all,
        )
    elif segment_type == "apply":
        segmentation = await apply(images, UID, save_mode, large_w, large_h)
    response = Response(segmentation.tobytes())
    response.headers.add("Content-Type", "application/octet-stream")
    return response


@app.route("/segmenting", methods=["POST", "GET", "OPTIONS"])
async def segment_respond():
    response = await generic_response(request, segment_fn)
    return response


# ================================= SAVING =================================
async def save_fn(request) -> Response:
    UID = request.json["id"]
    save_type = request.json["type"]
    if save_type == "segmentation":
        response = send_file(
            f"{CWD}/{UID}/seg.tiff", mimetype="image/tiff", download_name="seg.tiff"
        )
    else:
        file_format = request.json["format"]
        response = send_file(
            f"{CWD}/{UID}/classifier{file_format}",
            mimetype="application/octet-stream",
            download_name=f"classifier{file_format}",
        )
    return response


@app.route("/saving", methods=["POST", "GET", "OPTIONS"])
async def save_respond():
    response = await generic_response(request, save_fn)
    return response


async def save_labels_fn(request) -> Response:
    images = [_get_image_from_b64(i) for i in request.json["images"]]
    labels_dicts = request.json["labels"]
    save_mode = request.json["save_mode"]
    large_w, large_h = request.json["large_w"], request.json["large_h"]
    rescale = request.json["rescale"]
    labels_bytes = save_labels(
        images, labels_dicts, save_mode, large_w, large_h, rescale
    )
    response = Response(labels_bytes)
    response.headers.add("Content-Type", "application/octet-stream")
    return response


@app.route("/slabel", methods=["POST", "GET", "OPTIONS"])
async def save_labels_respond():
    response = await generic_response(request, save_labels_fn)
    return response


# ================================= LOADING =================================
async def load_classifier_fn(request):
    UID = request.json["id"]
    classifier_b64_with_prefix = request.json["bytes"]
    b64 = classifier_b64_with_prefix.split(",")[1]
    classifier_bytes = base64.standard_b64decode(b64)
    await load_classifier_from_http(classifier_bytes, CWD, UID)
    response = Response("{'foo': 'bar'}", status=200)
    return response


@app.route("/lclassifier", methods=["POST", "GET", "OPTIONS"])
async def load_classifier_respond():
    response = await generic_response(request, load_classifier_fn)
    return response


if __name__ == "__main__":
    app.run()


# ================================= SAVE TO GALLERY =================================
def get_blob_service_client():
    account_url = 'https://sambasegment.blob.core.windows.net'
    credential = dotenv.get_key(dotenv.find_dotenv(), "AZURE_STORAGE_KEY")
    # Create the BlobServiceClient object
    blob_service_client = BlobServiceClient(account_url,credential=credential)
    return blob_service_client

def upload_blob_file(fn, UID, blob_service_client: BlobServiceClient):
    container_client = blob_service_client.get_container_client(container='gallery')
    with open(file=fn, mode="rb") as data:
        blob_client = container_client.upload_blob(name=f'{UID}.jpeg', data=data, overwrite=True)

async def save_to_gallery_fn(request) -> Response:
    UID = request.json["id"]
    try:
        upload_blob_file(f"{CWD}/{UID}/seg_thumbnail.jpg", UID+'_seg', blob_service_client=get_blob_service_client())
        upload_blob_file(f"{CWD}/{UID}/img_thumbnail.jpg", UID+'_img', blob_service_client=get_blob_service_client())
    except Exception as e:
        print(e)
    return Response(status=200)


@app.route("/saveToGallery", methods=["POST", "GET", "OPTIONS"])
async def save_to_gallery_respond():
    response = await generic_response(request, save_to_gallery_fn)
    return response


# ================================= SAVE IMAGE AS JPEG =================================
async def save_image_fn(request) -> Response:
    UID = request.json["id"]
    try:
        image = _get_image_from_b64(request.json["images"]).crop((0, 0, 300, 300))
        image.save(f"{CWD}/{UID}/img_thumbnail.jpg")
    except Exception as e:
        print(e)
    return Response(status=200)

@app.route("/saveImage", methods=["POST", "GET", "OPTIONS"])
async def save_image_respond():
    response = await generic_response(request, save_image_fn)
    return response