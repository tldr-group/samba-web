path = "/home/ronan/Documents/uni_work/phd/samba-web/backend/test_resources/"
print(path+"classification_config.txt");
dynamic_data_str = File.openAsString(path+"classification_config.txt");
dynamic_data_arr = split(dynamic_data_str, "\n");

fname = dynamic_data_arr[0];
fname_arr = split(fname, ".");
img_name = fname_arr[0];

filter_data_arr = Array.slice(dynamic_data_arr, 1)

open(path+fname);

// Open Weka
run("Trainable Weka Segmentation");
// Need to wait as loading GUI
wait(800);
selectWindow("Trainable Weka Segmentation v3.3.4");

roi_str = File.openAsString(path+img_name+"_roi_config.txt");
roi_data_arr = split(roi_str, "\n");

n_classes = 1

roi_arr = newArray(4);
class = "0";
counter = 0;
for (i=0; i<roi_data_arr.length; i++){
	line = roi_data_arr[i];
	if (startsWith(line, "N")) { // create rectangle label, add it to weka
		makeRectangle(roi_arr[0], roi_arr[1], roi_arr[2], roi_arr[3]);
		call("trainableSegmentation.Weka_Segmentation.addTrace", class, "1");
		counter = 0;
	}
	else if (startsWith(line, "#")){ // comments
		print(line);
	}
	else if (counter == 4){
		class = line;
		// need to add new classes
		if (parseInt(class) > n_classes){
			n_classes++;
			call("trainableSegmentation.Weka_Segmentation.createNewClass", int);
		}
		counter++;
	}
	else { // add roi coord
		int = parseInt(line);
		roi_arr[counter] = int;
		counter++;
	}
}

// loop through filter config file and turn on any filter found there
for (i=0; i<filter_data_arr.length; i++){
	filter_command = filter_data_arr[i];
	print(filter_command);
	call("trainableSegmentation.Weka_Segmentation.setFeature", filter_command);
}

call("trainableSegmentation.Weka_Segmentation.setClassBalance", "true");

// train current classifier
call("trainableSegmentation.Weka_Segmentation.trainClassifier");

// open result window
out_img = call("trainableSegmentation.Weka_Segmentation.getResult");
img_title = "output.tif";
selectWindow("Classified image");
// saves to whichever folder fiji has been run from
saveAs("tif", path+img_title);
run("Close");

//selectWindow("Trainable Weka Segmentation v3.3.2");
//run("Close");

// selectWindow("Log");
//run("Close" );
// run("Close All" );
eval("script", "System.exit(0);");